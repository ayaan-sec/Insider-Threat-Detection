# Insider Threat Detection Web Application

A minimal, user-friendly web application for analyzing logon data to identify suspicious after-hours logins and potential insider threats using machine learning.

## Features

- **CSV File Upload**: Upload your logon data in CSV format
- **Anomaly Detection**: Uses Isolation Forest ML algorithm to identify suspicious user-days
- **Data Analysis**: Displays comprehensive statistics and visualizations
- **User Timeline**: Interactive charts showing after-hours login patterns for each user
- **Clean Black & White GUI**: Minimal, professional interface

## Prerequisites

- Python 3.8+
- pip (Python package installer)

## Installation

1. **Navigate to the project directory**:
   ```bash
   cd /home/deeto/Desktop/Wokr/M_P
   ```

2. **Create a virtual environment** (optional but recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

## Running the Application

1. **Start the Flask server**:
   ```bash
   python app.py
   ```

2. **Open your browser** and navigate to:
   ```
   http://localhost:5000
   ```

3. **Upload your CSV file**:
   - Your CSV should have columns: `user` and `time`
   - Example time format: `2023-01-15 14:30:00`

4. **Analyze the results**:
   - View summary statistics
   - See top suspicious user-days
   - Explore individual user timelines

## CSV File Format

Your logon data CSV should include at minimum:
- `user`: Username or user ID
- `time`: Timestamp of login (ISO format preferred)

Example:
```
user,time,device,source_ip
john.doe,2023-01-15 07:45:00,LAPTOP1,192.168.1.100
jane.smith,2023-01-15 22:30:00,DESKTOP2,192.168.1.101
john.doe,2023-01-16 09:00:00,LAPTOP1,192.168.1.100
```

## Understanding the Results

### Key Metrics

- **After-Hours Logins**: Logins occurring before 8 AM, after 6 PM, or on weekends
- **After-Hours Ratio**: Percentage of a user's daily logins that occur after-hours
- **Risk Score**: 100 for flagged anomalies, 10 for normal behavior

### Suspicious User-Days

The application flags user-days as suspicious when:
- Multiple after-hours logins occur
- After-hours logins are unusual compared to the user's normal pattern
- The Isolation Forest model identifies statistical outliers

## Customization

### Adjusting Sensitivity

Edit `app.py` and modify the `contamination` parameter in the Isolation Forest model:

```python
model = IsolationForest(
    n_estimators=200,
    contamination=0.01,  # Change this: 0.01 = 1%, 0.05 = 5%, etc.
    random_state=42
)
```

### Business Hours

Modify the after-hours detection logic in `app.py`:

```python
# Currently: before 8am or after 6pm
df["is_after_hours"] = ((df["hour"] < 8) | (df["hour"] > 18) | (df["weekday"] >= 5))
```

## Troubleshooting

### "Column 'user' not found"
- Ensure your CSV has a column named `user`
- Check for typos in column names

### "Invalid/missing time after conversion"
- Verify time format is ISO standard: `YYYY-MM-DD HH:MM:SS`
- Check for missing or malformed timestamps

### Port already in use
- Change the port in `app.py`:
  ```bash
  app.run(debug=True, port=5001)  # Use 5001 instead of 5000
  ```

## Architecture

- **Backend**: Flask (Python web framework)
- **Frontend**: HTML/CSS/JavaScript (no external UI framework)
- **ML**: scikit-learn Isolation Forest
- **Data Processing**: pandas, NumPy
- **Visualization**: Chart.js

## Files

```
├── app.py                  # Flask backend
├── requirements.txt        # Python dependencies
├── templates/
│   └── index.html         # Main HTML template
└── static/
    ├── style.css          # Minimal black & white styling
    └── app.js             # Frontend JavaScript
```

## Notes

- Maximum file size: 50MB
- The application processes data entirely in memory
- For large datasets (>1M rows), consider running on a machine with adequate RAM

## License

This project is provided as-is for educational purposes.
