# 🌞 EcoVision – AI-Powered Solar Placement Optimization System

EcoVision is an AI-driven web application designed to optimize rooftop solar panel installations using Computer Vision, Solar Positioning Algorithms, and Generative AI.

The platform analyzes rooftop images to detect obstructions, calculates available installation area, determines optimal solar panel orientation, and generates intelligent energy recommendations.

---

## 🚀 Core Features

### 🔍 AI-Based Rooftop Analysis
- Upload rooftop image or capture via device camera
- Custom-trained YOLOv8 models detect:
  - Poles
  - Water tanks
  - Roof boundaries
  - Trees
- Calculates obstruction-free usable rooftop area
- Visual masking of detected objects

---

### ☀️ Solar Positioning Engine
- Uses `pysolar` to compute real-time:
  - Solar Altitude
  - Solar Azimuth
- Suggests:
  - Optimal tilt angle (based on latitude)
  - Best compass orientation for maximum efficiency

---

### 🤖 Generative AI Recommendations
- Integrated with Google Gemini (Generative AI)
- Analyzes:
  - Free rooftop area
  - Tilt & orientation
  - Solar metrics
- Provides:
  - Panel placement suggestions
  - Efficiency improvement tips
  - Design optimization insights

---

### 📄 Automated PDF Report Generation
- Generates downloadable `solar_report.pdf`
- Includes:
  - Processed rooftop image
  - Technical solar metrics
  - Location data
  - AI-generated recommendations
- Built using ReportLab

---

### 🇮🇳 Government Subsidy Navigator
- Dedicated Indian solar subsidy section
- State & Union Territory-based filtering
- Includes MNRE & PM-KUSUM scheme references

---

## 🛠️ Tech Stack

### Backend
- Python
- Flask
- Ultralytics YOLOv8
- PySolar
- Google Generative AI (Gemini API)
- OpenCV
- NumPy
- Pillow
- ReportLab

### Frontend
- HTML5
- CSS3
- JavaScript (Vanilla)
- Responsive Design

---

## 📂 Project Structure

```
EcoVisionSolarPlacement/
│
├── static/
│   ├── app.js
│   ├── style.css
│   └── govt_subsidy.css
│
├── templates/
│   ├── index.html
│   └── govt_subsidy.html
│
├── uploads/
│
├── app.py
├── pole_best.pt
├── tank_best.pt
├── roof_best.pt
├── tree_best.pt
├── requirements.txt
└── README.md
```

---

## ⚙️ Installation & Setup

### Prerequisites
- Python 3.8+
- Google Gemini API Key

---

### 1️⃣ Clone Repository

```bash
git clone https://github.com/yourusername/EcoVisionSolarPlacement.git
cd EcoVisionSolarPlacement
```

---

### 2️⃣ Install Dependencies

```bash
pip install -r requirements.txt
```

---

### 3️⃣ Configure Gemini API Key

Open `app.py` and update:

```python
genai.configure(api_key="YOUR_API_KEY")
```

---

### 4️⃣ Verify YOLO Model Files

Ensure the following weight files are present:

- pole_best.pt
- tank_best.pt
- roof_best.pt
- tree_best.pt
- yolov8n.pt (if required)

---

### 5️⃣ Run Application

```bash
python app.py
```

Application runs at:

```
http://0.0.0.0:5000/
```

---

## 📖 Usage

1. Upload or capture rooftop image
2. Click Analyze
3. View:
   - Detected obstructions
   - Free area %
   - Solar tilt & orientation
4. Generate AI recommendations
5. Download PDF report
6. Explore government subsidy section

---

## 🎯 Vision & Impact

EcoVision supports:

- Sustainable energy adoption
- Smart rooftop solar deployment
- AI for Climate Change Mitigation
- Data-driven renewable infrastructure planning

---

## 🔮 Future Enhancements

- Google Maps satellite integration
- ROI & payback period calculator
- Carbon footprint reduction estimator
- Installer marketplace integration
- Multi-country subsidy expansion

---

## 👨‍💻 Author

Khurram Rashid

If this project helped you, consider starring the repository ⭐
