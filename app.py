from flask import Flask, render_template, request, jsonify
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
import io
import json
from datetime import datetime

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file size

# Global variable to store the processed data
processed_data = {}

def process_logon_data(file_content):
    """Process logon CSV file and return threat detection results."""
    try:
        df = pd.read_csv(io.StringIO(file_content))
        
        # Convert time column to datetime
        df["time"] = pd.to_datetime(df["time"], errors="coerce")
        bad_times = df["time"].isna().sum()
        df = df.dropna(subset=["time"]).copy()
        
        # Extract time features
        df["date"] = df["time"].dt.date
        df["hour"] = df["time"].dt.hour
        df["weekday"] = df["time"].dt.weekday
        
        # Flag after-hours/weekend logins
        df["is_after_hours"] = ((df["hour"] < 8) | (df["hour"] > 18) | (df["weekday"] >= 5)).astype(int)
        
        # Group by user + date
        user_col = "user"
        if user_col not in df.columns:
            return {"error": f"Column '{user_col}' not found in CSV"}, None
        
        daily = df.groupby([user_col, "date"]).agg(
            logins_total=("time", "count"),
            after_hours_logins=("is_after_hours", "sum"),
        ).reset_index()
        
        # Create ratio
        daily["logins_total"] = daily["logins_total"].fillna(0)
        daily["after_hours_logins"] = daily["after_hours_logins"].fillna(0)
        daily["after_hours_ratio"] = np.where(
            daily["logins_total"] > 0,
            daily["after_hours_logins"] / daily["logins_total"],
            0.0
        )
        
        # Train Isolation Forest
        features = ["logins_total", "after_hours_ratio"]
        X = daily[features].fillna(0)
        
        model = IsolationForest(
            n_estimators=200,
            contamination=0.01,
            random_state=42
        )
        model.fit(X)
        
        # Add predictions
        daily["anomaly"] = model.predict(X)
        daily["risk_score"] = np.where(daily["anomaly"] == -1, 100, 10)
        daily["date"] = daily["date"].astype(str)
        
        # Get suspicious days
        suspicious_days = daily[daily["anomaly"] == -1].copy()
        
        # Top suspicious user-days
        top_days = suspicious_days.sort_values(
            by=["after_hours_ratio", "after_hours_logins", "logins_total"],
            ascending=False
        ).head(15)
        
        # Most suspicious users
        user_summary = suspicious_days.groupby(user_col).agg(
            suspicious_days=("date", "count"),
            avg_after_hours_ratio=("after_hours_ratio", "mean"),
            total_after_hours_logins=("after_hours_logins", "sum"),
        ).reset_index()
        
        user_summary = user_summary.sort_values(
            by=["suspicious_days", "avg_after_hours_ratio"],
            ascending=False
        )
        
        return {
            "status": "success",
            "total_records": len(df),
            "total_user_days": len(daily),
            "suspicious_user_days": len(suspicious_days),
            "total_users": daily[user_col].nunique(),
            "suspicious_users": len(user_summary),
            "top_days": top_days.to_dict('records'),
            "top_users": user_summary.head(15).to_dict('records'),
            "all_users": sorted(daily[user_col].dropna().unique().tolist()),
            "daily_data": daily.to_dict('records')
        }, daily
    
    except Exception as e:
        return {"error": str(e)}, None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload():
    """Handle CSV file upload."""
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
    
    if not file.filename.endswith('.csv'):
        return jsonify({"error": "Please upload a CSV file"}), 400
    
    try:
        file_content = file.read().decode('utf-8')
        result, daily_df = process_logon_data(file_content)
        
        if "error" in result:
            return jsonify(result), 400
        
        # Store processed data globally
        processed_data['daily'] = daily_df
        
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/user-timeline/<user>')
def user_timeline(user):
    """Get timeline data for a specific user."""
    if 'daily' not in processed_data or processed_data['daily'] is None:
        return jsonify({"error": "No data loaded"}), 400
    
    daily = processed_data['daily']
    user_data = daily[daily['user'] == user].copy()
    user_data = user_data.sort_values('date')
    
    if len(user_data) == 0:
        return jsonify({"error": f"No data found for user {user}"}), 404
    
    return jsonify({
        "user": user,
        "data": [
            {
                "date": str(row['date']),
                "logins_total": int(row['logins_total']),
                "after_hours_logins": int(row['after_hours_logins']),
                "after_hours_ratio": float(row['after_hours_ratio']),
                "anomaly": int(row['anomaly']),
                "risk_score": int(row['risk_score'])
            }
            for _, row in user_data.iterrows()
        ],
        "avg_ratio": float(user_data['after_hours_ratio'].mean()),
        "avg_risk_score": float(user_data['risk_score'].mean())
    }), 200

if __name__ == '__main__':
    app.run(debug=True, port=5000)
