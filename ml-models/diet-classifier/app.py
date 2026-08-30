import os
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd

app = Flask(__name__)
CORS(app)  # Enable Cross-Origin Resource Sharing for ChefNest node integration

# Path configuration
current_dir = os.path.dirname(os.path.abspath(__file__))
models_dir = os.path.join(current_dir, 'saved_models')
model_path = os.path.join(models_dir, 'diet_classifier_model.pkl')
encoder_path = os.path.join(models_dir, 'label_encoder.pkl')
food_encoder_path = os.path.join(models_dir, 'food_type_encoder.pkl')

model = None
label_encoder = None
food_type_encoder = None

def load_model():
    global model, label_encoder, food_type_encoder
    if os.path.exists(model_path) and os.path.exists(encoder_path) and os.path.exists(food_encoder_path):
        try:
            model = joblib.load(model_path)
            label_encoder = joblib.load(encoder_path)
            food_type_encoder = joblib.load(food_encoder_path)
            print("✅ ML Model and Encoders loaded successfully.")
        except Exception as e:
            print(f"❌ Error loading model files: {e}")
    else:
        print("⚠️ Warning: Model files not found. Please run train_model.py first to train the model.")

# Load model initially
load_model()

@app.route('/health', methods=['GET'])
def health():
    status = "ready" if (model is not None and label_encoder is not None and food_type_encoder is not None) else "model_not_loaded"
    return jsonify({"status": "running", "model_status": status})

@app.route('/predict', methods=['POST'])
def predict():
    global model, label_encoder, food_type_encoder
    
    # Reload model if it wasn't loaded initially (e.g. trained after server started)
    if model is None or label_encoder is None or food_type_encoder is None:
        load_model()
        if model is None or label_encoder is None or food_type_encoder is None:
            return jsonify({
                "success": False, 
                "message": "Model or Encoders not available. Please run train_model.py to train the model first."
            }), 503

    try:
        data = request.get_json(force=True)
        
        # Extract features (match training schema)
        calories = float(data.get('calories', 0))
        protein_g = float(data.get('protein_g', data.get('protein', 0)))
        fat_g = float(data.get('fat_g', data.get('fat', 0)))
        carbs_g = float(data.get('carbs_g', data.get('carbs', 0)))
        fiber_g = float(data.get('fiber_g', 0))
        sugar_g = float(data.get('sugar_g', 0))
        sodium_mg = float(data.get('sodium_mg', 0))
        
        # Handle food_type categorical encoding
        food_type = str(data.get('food_type', 'Other')).strip()
        if food_type not in food_type_encoder.classes_:
            # Fallback to 'Other' or first class if not found
            food_type = 'Other' if 'Other' in food_type_encoder.classes_ else food_type_encoder.classes_[0]
            
        food_type_encoded = food_type_encoder.transform([food_type])[0]
        
        # Prepare feature dataframe matching training schema exactly:
        # ['calories', 'protein_g', 'fat_g', 'carbs_g', 'fiber_g', 'sugar_g', 'sodium_mg', 'food_type_encoded']
        input_data = pd.DataFrame([{
            'calories': calories,
            'protein_g': protein_g,
            'fat_g': fat_g,
            'carbs_g': carbs_g,
            'fiber_g': fiber_g,
            'sugar_g': sugar_g,
            'sodium_mg': sodium_mg,
            'food_type_encoded': food_type_encoded
        }])
        
        # Predict class index
        pred_idx = model.predict(input_data)[0]
        
        # Decode target label
        diet_label = label_encoder.inverse_transform([pred_idx])[0]
        
        # Get probability estimation if model supports it
        probabilities = {}
        if hasattr(model, "predict_proba"):
            probs = model.predict_proba(input_data)[0]
            for idx, prob in enumerate(probs):
                class_name = label_encoder.inverse_transform([idx])[0]
                probabilities[class_name] = round(float(prob), 4)
        
        return jsonify({
            "success": True,
            "prediction": diet_label,
            "probabilities": probabilities
        })
        
    except ValueError as val_err:
        return jsonify({"success": False, "message": f"Invalid numerical inputs: {str(val_err)}"}), 400
    except Exception as e:
        return jsonify({"success": False, "message": f"Prediction error: {str(e)}"}), 500

if __name__ == '__main__':
    # Run Flask local server on port 5000
    app.run(host='0.0.0.0', port=5000, debug=True)
