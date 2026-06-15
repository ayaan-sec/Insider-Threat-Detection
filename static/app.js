// === Global Variables ===
let allData = null;
let allUsers = [];
let timelineChart = null;

// === DOM Elements ===
const uploadArea = document.getElementById('uploadArea');
const csvFile = document.getElementById('csvFile');
const analyzeBtn = document.getElementById('analyzeBtn');
const uploadStatus = document.getElementById('uploadStatus');
const loadingSpinner = document.getElementById('loadingSpinner');
const userSelect = document.getElementById('userSelect');
const timelineContainer = document.getElementById('timelineContainer');

// === Upload Handlers ===
uploadArea.addEventListener('click', () => csvFile.click());

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        csvFile.files = files;
        handleFileSelect();
    }
});

csvFile.addEventListener('change', handleFileSelect);

function handleFileSelect() {
    if (csvFile.files.length > 0) {
        const file = csvFile.files[0];
        if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
            analyzeBtn.disabled = false;
            uploadStatus.className = '';
            uploadStatus.style.display = 'none';
        } else {
            showStatus('Please select a CSV file', 'error');
            analyzeBtn.disabled = true;
        }
    }
}

analyzeBtn.addEventListener('click', uploadFile);

function showStatus(message, type) {
    uploadStatus.textContent = message;
    uploadStatus.className = type;
}

// === File Upload and Analysis ===
function uploadFile() {
    const file = csvFile.files[0];
    if (!file) {
        showStatus('Please select a file', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    loadingSpinner.style.display = 'flex';
    analyzeBtn.disabled = true;

    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        loadingSpinner.style.display = 'none';
        analyzeBtn.disabled = false;

        if (data.error) {
            showStatus('Error: ' + data.error, 'error');
            return;
        }

        allData = data;
        allUsers = data.all_users || [];
        
        showStatus('✅ Analysis complete! ' + data.suspicious_user_days + ' suspicious user-days found.', 'success');
        displayResults(data);
    })
    .catch(error => {
        loadingSpinner.style.display = 'none';
        analyzeBtn.disabled = false;
        showStatus('Error: ' + error.message, 'error');
        console.error('Error:', error);
    });
}

// === Display Results ===
function displayResults(data) {
    // Show summary
    document.getElementById('totalRecords').textContent = data.total_records.toLocaleString();
    document.getElementById('totalUsers').textContent = data.total_users;
    document.getElementById('suspiciousUsers').textContent = data.suspicious_users;
    document.getElementById('suspiciousDays').textContent = data.suspicious_user_days;
    document.getElementById('summarySection').style.display = 'block';

    // Display top suspicious days
    if (data.top_days && data.top_days.length > 0) {
        displayTopDays(data.top_days);
        document.getElementById('threatsSection').style.display = 'block';
    }

    // Display top users
    if (data.top_users && data.top_users.length > 0) {
        displayTopUsers(data.top_users);
        document.getElementById('usersSection').style.display = 'block';
    }

    // Setup user timeline section
    if (data.all_users && data.all_users.length > 0) {
        populateUserSelect(data.all_users);
        document.getElementById('timelineSection').style.display = 'block';
    }

    // Scroll to summary
    setTimeout(() => {
        document.getElementById('summarySection').scrollIntoView({ behavior: 'smooth' });
    }, 100);
}

function displayTopDays(topDays) {
    const tbody = document.querySelector('#topDaysTable tbody');
    tbody.innerHTML = '';

    topDays.forEach(day => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${day.user}</td>
            <td>${day.date}</td>
            <td>${day.logins_total}</td>
            <td>${day.after_hours_logins}</td>
            <td>${(day.after_hours_ratio * 100).toFixed(1)}%</td>
            <td><strong>${day.risk_score}</strong></td>
        `;
        tbody.appendChild(row);
    });
}

function displayTopUsers(topUsers) {
    const tbody = document.querySelector('#topUsersTable tbody');
    tbody.innerHTML = '';

    topUsers.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${user.user}</strong></td>
            <td>${user.suspicious_days}</td>
            <td>${(user.avg_after_hours_ratio * 100).toFixed(1)}%</td>
            <td>${user.total_after_hours_logins}</td>
            <td><button class="btn btn-secondary" onclick="selectUserAndScroll('${user.user}')">View Timeline</button></td>
        `;
        tbody.appendChild(row);
    });
}

function populateUserSelect(users) {
    userSelect.innerHTML = '<option value="">-- Choose a user --</option>';
    
    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user;
        option.textContent = user;
        userSelect.appendChild(option);
    });
}

userSelect.addEventListener('change', handleUserSelect);

function selectUserAndScroll(username) {
    userSelect.value = username;
    handleUserSelect();
    document.getElementById('timelineContainer').scrollIntoView({ behavior: 'smooth' });
}

function handleUserSelect() {
    const selectedUser = userSelect.value;
    timelineContainer.style.display = 'none';

    if (!selectedUser) {
        return;
    }

    loadingSpinner.style.display = 'flex';

    fetch(`/user-timeline/${encodeURIComponent(selectedUser)}`)
        .then(response => response.json())
        .then(data => {
            loadingSpinner.style.display = 'none';

            if (data.error) {
                alert('Error: ' + data.error);
                return;
            }

            displayUserTimeline(data);
        })
        .catch(error => {
            loadingSpinner.style.display = 'none';
            alert('Error: ' + error.message);
            console.error('Error:', error);
        });
}

function displayUserTimeline(data) {
    document.getElementById('avgRiskScore').textContent = data.avg_risk_score.toFixed(1);
    document.getElementById('avgRatio').textContent = (data.avg_ratio * 100).toFixed(1) + '%';
    timelineContainer.style.display = 'block';

    // Prepare chart data
    const labels = data.data.map(d => d.date);
    const ratios = data.data.map(d => d.after_hours_ratio);
    const anomalies = data.data.map(d => d.anomaly);

    // Color points based on anomaly status
    const colors = anomalies.map(a => a === -1 ? '#d32f2f' : '#000000');
    const pointRadius = anomalies.map(a => a === -1 ? 7 : 4);

    // Destroy existing chart if it exists
    if (timelineChart) {
        timelineChart.destroy();
    }

    // Create new chart
    const ctx = document.getElementById('timelineChart').getContext('2d');
    timelineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'After-Hours Ratio',
                    data: ratios,
                    borderColor: '#000000',
                    backgroundColor: 'rgba(0, 0, 0, 0.05)',
                    borderWidth: 2,
                    tension: 0.1,
                    pointRadius: pointRadius,
                    pointBackgroundColor: colors,
                    pointBorderColor: colors,
                    pointBorderWidth: 2,
                    fill: true
                },
                {
                    label: 'Average Ratio',
                    type: 'line',
                    data: Array(labels.length).fill(data.avg_ratio),
                    borderColor: '#d32f2f',
                    borderDash: [5, 5],
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    tension: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: {
                        font: { size: 12, weight: 'bold' },
                        color: '#000000'
                    }
                },
                title: {
                    display: true,
                    text: `Timeline for ${data.user}`,
                    font: { size: 14, weight: 'bold' },
                    color: '#000000'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 1,
                    ticks: {
                        color: '#000000',
                        font: { weight: 'bold' },
                        callback: function(value) {
                            return (value * 100).toFixed(0) + '%';
                        }
                    },
                    grid: {
                        color: '#e0e0e0'
                    },
                    title: {
                        display: true,
                        text: 'Ratio',
                        color: '#000000',
                        font: { weight: 'bold' }
                    }
                },
                x: {
                    ticks: {
                        color: '#000000',
                        font: { weight: 'bold' },
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: {
                        color: '#e0e0e0'
                    }
                }
            }
        }
    });
}

// === Initialize ===
console.log('Insider Threat Detection app loaded');
