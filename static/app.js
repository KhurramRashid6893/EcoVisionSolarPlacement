// Initialize solar chart
let solarChart;

function initChart() {
  const ctx = document.getElementById('solarChart').getContext('2d');
  solarChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      datasets: [{
        label: 'Estimated Solar Generation (kWh)',
        backgroundColor: 'rgba(39, 174, 96, 0.7)',
        borderColor: 'rgba(39, 174, 96, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'kWh'
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        title: {
          display: true,
          text: 'Monthly Energy Production Forecast'
        }
      }
    }
  });
}

function showLoading(show) {
  document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

// === GLOBAL ===
window.allResults = [];
window.currentLocation = null;
window.currentWeather = null;

// === GPS LOCATION ===
function getLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      position => {
        window.currentLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        
        // Update location fields
        document.getElementById('latitude').value = position.coords.latitude.toFixed(6);
        document.getElementById('longitude').value = position.coords.longitude.toFixed(6);
        document.getElementById('camera_latitude').value = position.coords.latitude.toFixed(6);
        document.getElementById('camera_longitude').value = position.coords.longitude.toFixed(6);
        
        // Update location text
        document.getElementById('locationText').textContent = 
          `Location: ${position.coords.latitude.toFixed(6)}° N, ${position.coords.longitude.toFixed(6)}° W`;
        
        // Show location card
        document.getElementById('locationCard').style.display = 'block';
        
        // Simulate weather data
        simulateWeatherData();
      },
      error => {
        console.error('Error getting location:', error);
        document.getElementById('locationText').textContent = 'Location not available';
      }
    );
  } else {
    console.error('Geolocation is not supported by this browser.');
    document.getElementById('locationText').textContent = 'Geolocation not supported';
  }
}

function simulateWeatherData() {
  // This would be replaced by actual API call in production
  window.currentWeather = {
    temp: 24,
    condition: 'Sunny',
    wind: '12 km/h',
    humidity: '45%',
    uv: '7 High',
    clouds: '10%',
    forecastTemp: 23,
    forecastCondition: 'Partly cloudy',
    solarIndex: '85%'
  };
  
  // Update weather widgets
  document.getElementById('currentTemp').textContent = `${window.currentWeather.temp}°C`;
  document.getElementById('currentWeather').textContent = window.currentWeather.condition;
  document.getElementById('windSpeed').textContent = window.currentWeather.wind;
  document.getElementById('humidity').textContent = window.currentWeather.humidity;
  document.getElementById('uvIndex').textContent = window.currentWeather.uv;
  document.getElementById('cloudCover').textContent = window.currentWeather.clouds;
  document.getElementById('forecastTemp').textContent = `${window.currentWeather.forecastTemp}°C`;
  document.getElementById('forecastWeather').textContent = window.currentWeather.forecastCondition;
  document.getElementById('solarIndex').textContent = window.currentWeather.solarIndex;
}

// === CAMERA SETUP ===
const openCameraBtn = document.getElementById('openCamera');
const cameraRow = document.getElementById('cameraRow');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const snap = document.getElementById('snap');
const cameraInput = document.getElementById('camera_image_input');
let currentStream = null;

if (openCameraBtn) {
  openCameraBtn.addEventListener('click', function () {
    cameraRow.style.display = 'flex';
    canvas.style.display = 'none';
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => {
          currentStream = stream;
          video.srcObject = stream;
          video.play();
        })
        .catch(() => alert('Camera access denied or not available.'));
    } else {
      alert('Camera API not supported in this browser.');
    }
  });
}

if (snap) {
  snap.addEventListener('click', function () {
    if (!currentStream) {
      alert("Please open the camera first!");
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.style.display = 'block';

    canvas.toBlob(function (blob) {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = function () {
        cameraInput.value = reader.result;
        window.lastImageDataUrl = reader.result;
      };
    }, 'image/jpeg');
  });
}

function stopCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }
  video.srcObject = null;
  cameraRow.style.display = 'none';
}

// === MULTIPLE IMAGE UPLOAD ===
document.getElementById('uploadForm').addEventListener('submit', function (e) {
  e.preventDefault();
  const files = this.querySelector('input[name="images"]').files;
  if (!files.length) {
    alert("Please select at least one image.");
    return;
  }
  
  // Get location and time
  const latitude = document.getElementById('latitude').value;
  const longitude = document.getElementById('longitude').value;
  const time = document.getElementById('time').value;
  
  if (!latitude || !longitude) {
    alert("Please enter location coordinates");
    return;
  }
  
  showLoading(true);
  window.allResults = [];
  document.getElementById('resultsContainer').innerHTML = '';
  analyzeMultipleImages(Array.from(files), latitude, longitude, time);
});

function analyzeMultipleImages(files, latitude, longitude, time) {
  let promises = files.map(file => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = function (event) {
        const imgDataUrl = event.target.result;
        const formData = new FormData();
        formData.append('image', file);
        formData.append('latitude', latitude);
        formData.append('longitude', longitude);
        formData.append('time', time);

        fetch('/analyze', { method: 'POST', body: formData })
          .then(res => res.json())
          .then(data => {
            data.imageDataUrl = imgDataUrl;
            window.allResults.push(data);
            displaySingleResult(data);
            resolve(data);
          })
          .catch(() => {
            alert(`Failed to analyze ${file.name}`);
            resolve(null);
          });
      };
      reader.readAsDataURL(file);
    });
  });

  Promise.all(promises).then(() => {
    showLoading(false);
    if (window.allResults.length > 0) {
      const best = window.allResults.reduce((best, curr) =>
        curr && (!best || curr.recommended_free_area_percent > best.recommended_free_area_percent)
          ? curr : best, null
      );
      updateResultsCard(best);
    }
  });
}

// === DISPLAY SINGLE RESULT ===
function displaySingleResult(data) {
  const resultContainer = document.createElement('div');
  resultContainer.className = 'card result';
  resultContainer.innerHTML = `
    <h2>Analysis Result</h2>
    <div class="result-content">
      <img src="${data.imageDataUrl}" class="result-img" />
      <div class="result-text">
        <p>✅ <strong>Free Area:</strong> ${data.recommended_free_area_percent}%</p>
        <p>✅ <strong>Tilt:</strong> ${data.suggested_tilt_angle}°</p>
        <p>✅ <strong>Orientation:</strong> ${data.suggested_orientation_dir} (${data.suggested_orientation_deg}°)</p>
        <p>${data.message}</p>
      </div>
    </div>
  `;
  document.getElementById('resultsContainer').appendChild(resultContainer);
}

// === UPDATE RESULTS CARD ===
function updateResultsCard(data) {
  // Show results card
  document.getElementById('resultsCard').style.display = 'block';
  
  // Update metrics
  document.getElementById('exposureValue').textContent = `${Math.min(100, Math.round(data.recommended_free_area_percent * 0.8))}%`;
  document.getElementById('tiltValue').textContent = `${data.suggested_tilt_angle}°`;
  document.getElementById('orientationValue').textContent = data.suggested_orientation_dir;
  document.getElementById('areaValue').textContent = `${Math.round(data.recommended_free_area_percent * 0.8)} m²`;
  
  // Update detailed results
  document.getElementById('optimalAngle').textContent = `${data.suggested_tilt_angle}°`;
  document.getElementById('shadowImpact').textContent = data.recommended_free_area_percent > 70 ? 'Low' : 
                                                      data.recommended_free_area_percent > 40 ? 'Medium' : 'High';
  document.getElementById('estimatedExposure').textContent = `${(data.sun_altitude / 15).toFixed(1)} hours/day`;
  document.getElementById('recommendedArea').textContent = `${Math.round(data.recommended_free_area_percent * 0.8)} m²`;
  document.getElementById('orientationText').textContent = `${data.suggested_orientation_dir} (${data.suggested_orientation_deg}°)`;
  
  // Calculate derived values
  const potentialOutput = (data.recommended_free_area_percent * 0.8 * 0.15).toFixed(1); // 150W per m²
  const annualSavings = (potentialOutput * 5 * 365 * 0.12).toFixed(0); // 5h/day, $0.12/kWh
  
  document.getElementById('potentialOutput').textContent = `${potentialOutput} kW`;
  document.getElementById('annualSavings').textContent = `$${annualSavings}`;
  
  // Update chart with realistic data
  const monthlyData = [];
  for (let i = 0; i < 12; i++) {
    // Simulate seasonal variation
    const baseOutput = potentialOutput * 5 * 30; // 5h/day * 30 days
    const variation = Math.sin(i * Math.PI / 6) * 0.3 + 0.8; // Seasonal variation
    monthlyData.push(Math.round(baseOutput * variation));
  }
  
  solarChart.data.datasets[0].data = monthlyData;
  solarChart.update();
  
  // Update result image
  document.getElementById('resultImage').src = window.allResults[0].imageDataUrl;
}

// === CAMERA FORM ===
document.getElementById('cameraForm').addEventListener('submit', function (e) {
  e.preventDefault();
  if (!cameraInput.value) {
    alert("Please capture an image before analyzing.");
    return;
  }
  
  // Get location and time
  const latitude = document.getElementById('camera_latitude').value;
  const longitude = document.getElementById('camera_longitude').value;
  const time = document.getElementById('camera_time').value;
  
  if (!latitude || !longitude) {
    alert("Please enter location coordinates");
    return;
  }
  
  // Add location and time to form data
  const formData = new FormData(this);
  formData.append('latitude', latitude);
  formData.append('longitude', longitude);
  formData.append('time', time);
  
  handleAnalyze(formData, 'cameraAnalyzeBtn', "Analyze Captured Image", true);
});

function handleAnalyze(formData, btnId, btnText, stopCam = false) {
  const btn = document.getElementById(btnId);
  btn.disabled = true;
  btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Processing...";
  showLoading(true);

  fetch('/analyze', { method: 'POST', body: formData })
    .then(res => res.json())
    .then(data => {
      data.imageDataUrl = window.lastImageDataUrl;
      window.allResults = [data];
      updateResultsCard(data);
      btn.disabled = false;
      btn.innerHTML = `<i class="fas fa-chart-line"></i> ${btnText}`;
      showLoading(false);
      if (stopCam) stopCamera();
    })
    .catch(() => {
      alert("Analysis failed. Please try again.");
      btn.disabled = false;
      btn.innerHTML = `<i class="fas fa-chart-line"></i> ${btnText}`;
      showLoading(false);
    });
}

// === AI RECOMMENDER ===
document.getElementById('aiRecommenderBtn').addEventListener('click', function () {
  const btn = this;
  btn.disabled = true;
  btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Generating...";
  showLoading(true);

  const best = window.allResults.reduce((best, curr) =>
    curr && (!best || curr.recommended_free_area_percent > best.recommended_free_area_percent)
      ? curr : best, null
  );

  if (!best) {
    alert("No analysis data found.");
    btn.disabled = false;
    btn.innerHTML = "<i class='fas fa-robot'></i> Get AI Recommendations";
    showLoading(false);
    return;
  }

  fetch('/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      free_area: best.recommended_free_area_percent,
      tilt: best.suggested_tilt_angle,
      orientation_deg: best.suggested_orientation_deg,
      orientation_dir: best.suggested_orientation_dir
    })
  })
    .then(res => res.json())
    .then(data => {
      const cleanText = data.recommendation
        .replace(/^\*+\s?/gm, '')
        .replace(/\n\*/g, '\n')
        .replace(/\n{2,}/g, '\n')
        .trim();

      document.getElementById('aiOutput').innerText = cleanText;
      document.getElementById('aiCard').style.display = 'block';
      btn.disabled = false;
      btn.innerHTML = "<i class='fas fa-robot'></i> Get AI Recommendations";
      showLoading(false);
    })
    .catch(() => {
      alert("Failed to fetch AI recommendation.");
      btn.disabled = false;
      btn.innerHTML = "<i class='fas fa-robot'></i> Get AI Recommendations";
      showLoading(false);
    });
});

// === DOWNLOAD REPORT ===
document.getElementById('downloadReportBtn').addEventListener('click', function () {
  showLoading(true);
  fetch('/download-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      results: window.allResults.map(r => ({
        free_area: r.recommended_free_area_percent,
        tilt: r.suggested_tilt_angle,
        orientation_deg: r.suggested_orientation_deg,
        orientation_dir: r.suggested_orientation_dir,
        image_base64: r.imageDataUrl
      })),
      ai_summary: document.getElementById('aiOutput') ? (document.getElementById('aiOutput').innerText || 'N/A') : 'N/A'
    })
  })
    .then(response => response.blob())
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = "solar_full_report.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showLoading(false);
    })
    .catch(() => {
      alert("Failed to generate report.");
      showLoading(false);
    });
});

// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', function() {
  // Initialize chart
  initChart();
  
  // Get current location
  getLocation();
  
  // Set current time
  const now = new Date();
  document.getElementById('time').value = now.toISOString().slice(0, 16);
  document.getElementById('camera_time').value = now.toISOString().slice(0, 16);
  
  // Toggle dark mode
  document.querySelector('.mode-toggle').addEventListener('click', function() {
    document.body.classList.toggle('dark-mode');
    const icon = this.querySelector('i');
    if (document.body.classList.contains('dark-mode')) {
      icon.classList.remove('fa-moon');
      icon.classList.add('fa-sun');
    } else {
      icon.classList.remove('fa-sun');
      icon.classList.add('fa-moon');
    }
  });
});



