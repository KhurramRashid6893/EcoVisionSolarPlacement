from flask import Flask, request, jsonify, render_template, send_file
from ultralytics import YOLO
from datetime import datetime
from pysolar.solar import get_altitude, get_azimuth
import pytz
import cv2
import numpy as np
import os
import base64
import google.generativeai as genai
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from PIL import Image
import requests
import concurrent.futures
import time

app = Flask(__name__)

# Configure Gemini API
genai.configure(api_key="AIzaSyCRSTkuwGQ9bQBz1ed-MGFSR-O6mfO4YxQ")
gemini_model = genai.GenerativeModel("gemini-2.0-flash")

# Load YOLO models with GPU acceleration if available
device = "cuda" if os.environ.get("CUDA_VISIBLE_DEVICES") else "cpu"
print(f"Loading models using device: {device}")
model_pole = YOLO('pole_best.pt').to(device)
model_tank = YOLO('tank_best.pt').to(device)
model_roof = YOLO('roof_best.pt').to(device)
model_tree = YOLO('tree_best.pt').to(device)
print("Models loaded")

# WeatherAPI configuration
WEATHER_API_KEY = "2aea46907e5c4fc099394105251103"
WEATHER_API_URL = "http://api.weatherapi.com/v1/current.json"

def azimuth_to_direction(azimuth):
    directions = [
        (0, "North"), (45, "Northeast"),
        (90, "East"), (135, "Southeast"),
        (180, "South"), (225, "Southwest"),
        (270, "West"), (315, "Northwest"), (360, "North")
    ]
    closest = min(directions, key=lambda x: abs(azimuth - x[0]))
    return closest[1]

def get_weather_data(lat, lon):
    """Fetch current weather data using GPS coordinates"""
    try:
        params = {
            'key': WEATHER_API_KEY,
            'q': f"{lat},{lon}",
            'aqi': 'no'
        }
        response = requests.get(WEATHER_API_URL, params=params, timeout=3)
        response.raise_for_status()
        data = response.json()
        
        return {
            'temp_c': data['current']['temp_c'],
            'condition': data['current']['condition']['text'],
            'wind_kph': data['current']['wind_kph'],
            'humidity': data['current']['humidity'],
            'uv': data['current']['uv'],
            'cloud': data['current']['cloud'],
            'icon': data['current']['condition']['icon']
        }
    except Exception as e:
        print(f"Weather API error: {str(e)}")
        return None

def run_model_inference(model, img, label, confidence_threshold):
    """Run model inference and return results"""
    results = model.predict(img, verbose=False, imgsz=480)
    detections = []
    for r in results:
        for box in r.boxes:
            conf = float(box.conf[0])
            if conf >= confidence_threshold:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                detections.append({
                    'label': label,
                    'confidence': round(conf, 3),
                    'bbox': [x1, y1, x2, y2]
                })
    return detections

def process_image(image_data, is_file=False):
    """Process image from either file upload or camera capture"""
    try:
        if is_file:
            # Read image directly from file stream
            nparr = np.frombuffer(image_data.read(), np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        else:
            # Process base64 image from camera
            header, encoded = image_data.split(',', 1)
            nparr = np.frombuffer(base64.b64decode(encoded), np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return None, "Invalid image format"
            
        # Resize image for faster processing
        max_dim = 480
        h, w = img.shape[:2]
        if max(h, w) > max_dim:
            scale = max_dim / max(h, w)
            img = cv2.resize(img, (int(w * scale), int(h * scale)))
        
        return img, None
        
    except Exception as e:
        return None, f"Image processing error: {str(e)}"

@app.route('/')
def index():
    return render_template('index.html')

# @app.route('/')
# def index():
#     return render_template('indexMobile.html')

@app.route('/govt_subsidy')
def govt_subsidy():
    return render_template('govt_subsidy.html')

@app.route('/analyze', methods=['POST'])
def analyze():
    start_time = time.time()
    
    # Process image based on source
    img = None
    if 'image' in request.files and request.files['image']:
        # Handle file upload
        file = request.files['image']
        img, error = process_image(file, is_file=True)
    elif 'camera_image' in request.form:
        # Handle camera image
        img, error = process_image(request.form['camera_image'])
    else:
        return jsonify({'error': 'No image provided'}), 400
    
    if error:
        return jsonify({'error': error}), 400
    
    height, width, _ = img.shape
    mask = np.zeros((height, width), dtype=np.uint8)
    obstructions = []
    
    # Run models in parallel
    CONFIDENCE_THRESHOLD = 0.5
    models = [
        (model_pole, 'pole'),
        (model_tank, 'tank'),
        (model_roof, 'roof'),
        (model_tree, 'tree')
    ]
    
    print("Starting model inference...")
    inference_start = time.time()
    
    with concurrent.futures.ThreadPoolExecutor() as executor:
        futures = []
        for model, label in models:
            futures.append(executor.submit(
                run_model_inference, 
                model, img, label, CONFIDENCE_THRESHOLD
            ))
        
        for future in concurrent.futures.as_completed(futures):
            detections = future.result()
            obstructions.extend(detections)
    
    print(f"Model inference completed in {time.time() - inference_start:.2f}s")
    
    # Create mask from detections
    for obs in obstructions:
        x1, y1, x2, y2 = obs['bbox']
        cv2.rectangle(mask, (x1, y1), (x2, y2), 255, -1)

    free_zone = cv2.bitwise_not(mask)
    free_percent = (cv2.countNonZero(free_zone) / (width * height)) * 100

    # Get location data
    try:
        lat = float(request.form.get('latitude', 0))
        lon = float(request.form.get('longitude', 0))
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid GPS coordinates'}), 400
        
    # Get time
    time_str = request.form.get('time')
    if time_str:
        time_obj = datetime.fromisoformat(time_str).astimezone(pytz.UTC)
    else:
        time_obj = datetime.now(pytz.UTC)

    # Calculate solar position
    altitude = get_altitude(lat, lon, time_obj)
    azimuth = get_azimuth(lat, lon, time_obj)

    suggested_orientation = round(azimuth, 2)
    orientation_dir = azimuth_to_direction(suggested_orientation)

    if altitude > 45:
        suggested_tilt = max(10, round(lat * 0.7, 1))
    else:
        suggested_tilt = round(lat, 1)
        
    # Get weather data in background thread
    weather_future = None
    with concurrent.futures.ThreadPoolExecutor() as executor:
        weather_future = executor.submit(get_weather_data, lat, lon)
    
    # Calculate solar potential metrics
    solar_index = min(100, max(10, int(100 - (free_percent * 0.2))))
    exposure_hours = max(2, min(12, round(altitude / 15, 1)))

    # Get weather results
    weather_data = weather_future.result() if weather_future else None
    
    print(f"Total analysis time: {time.time() - start_time:.2f}s")
    
    return jsonify({
        'obstructions': obstructions,
        'recommended_free_area_percent': round(free_percent, 2),
        'sun_altitude': round(altitude, 2),
        'sun_azimuth': round(azimuth, 2),
        'suggested_tilt_angle': suggested_tilt,
        'suggested_orientation_deg': suggested_orientation,
        'suggested_orientation_dir': orientation_dir,
        'message': f'Place panels in largest shadow-free zones facing {orientation_dir} with tilt {suggested_tilt}°!',
        'weather': weather_data,
        'solar_index': solar_index,
        'exposure_hours': exposure_hours,
        'latitude': lat,
        'longitude': lon
    })

@app.route('/recommend', methods=['POST'])
def recommend():
    data = request.json
    prompt = f"""
You are an expert solar consultant. Based on this data:
- Free area: {data.get('free_area')}%
- Tilt: {data.get('tilt')} degrees
- Orientation: {data.get('orientation_dir')} ({data.get('orientation_deg')} degrees)
- Location: {data.get('latitude')}°N, {data.get('longitude')}°W
- Weather: {data.get('weather', {}).get('condition', 'N/A') if data.get('weather') else 'N/A'}

Provide a **concise (max 100 words)**, **clear**, **well-formatted** set of recommendations in bullet points without asterisks or extra markdown.
"""
    try:
        response = gemini_model.generate_content(prompt)
        return jsonify({'recommendation': response.text.strip()})
    except Exception as e:
        print(f"Gemini API error: {str(e)}")
        return jsonify({'recommendation': 'Could not generate recommendations at this time.'})


@app.route('/download-report', methods=['POST'])
def download_report():
    data = request.json
    results = data.get('results', [])
    ai_summary = data.get('ai_summary', 'N/A')

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    c.setFont("Helvetica-Bold", 18)
    c.drawString(50, height - 50, "EcoVision Solar Placement Report")

    y = height - 80
    c.setFont("Helvetica", 12)

    for i, result in enumerate(results):
        if y < 150:
            c.showPage()
            y = height - 50

        # Add location and weather info
        location_text = f"Location: {result.get('latitude', 'N/A')}°N, {result.get('longitude', 'N/A')}°W"
        c.drawString(50, y, location_text)
        y -= 20
        
        if result.get('weather'):
            weather_text = f"Weather: {result['weather'].get('condition', 'N/A')}, {result['weather'].get('temp_c', 'N/A')}°C"
            c.drawString(50, y, weather_text)
            y -= 20
        
        # Main result
        result_text = f"Result {i+1}: Free Area {result.get('free_area')}%, Tilt {result.get('tilt')}°, Orientation {result.get('orientation_dir')} ({result.get('orientation_deg')}°)"
        c.drawString(50, y, result_text)
        y -= 20

        img_data = result.get('image_base64')
        if img_data and ',' in img_data:
            try:
                _, encoded = img_data.split(',', 1)
                img_bytes = base64.b64decode(encoded)
                img = Image.open(BytesIO(img_bytes))
                img.thumbnail((200, 150))
                img_io = BytesIO()
                img.save(img_io, format='PNG')
                img_io.seek(0)
                c.drawImage(ImageReader(img_io), 50, y - 150, width=200, height=150)
                y -= 160
            except Exception as e:
                print(f"Error processing image for PDF: {str(e)}")
                y -= 10
        else:
            y -= 10

    # AI Summary
    if y < 150:
        c.showPage()
        y = height - 50

    c.setFont("Helvetica-Bold", 14)
    c.drawString(50, y, "AI Recommendations Summary")
    y -= 20

    c.setFont("Helvetica", 10)
    text = c.beginText(50, y)
    text.setFont("Helvetica", 10)
    for line in ai_summary.split('\n'):
        text.textLine(line.strip())
    c.drawText(text)

    c.save()
    buffer.seek(0)
    return send_file(buffer, as_attachment=True, download_name="solar_full_report.pdf", mimetype='application/pdf')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)