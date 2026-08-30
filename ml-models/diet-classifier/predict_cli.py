import os
import sys
import json
import warnings
warnings.filterwarnings('ignore')

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

import joblib
import pandas as pd

current_dir = os.path.dirname(os.path.abspath(__file__))
models_dir = os.path.join(current_dir, 'saved_models')
model_path = os.path.join(models_dir, 'diet_classifier_model.pkl')
encoder_path = os.path.join(models_dir, 'label_encoder.pkl')
food_encoder_path = os.path.join(models_dir, 'food_type_encoder.pkl')

def main():
    try:
        input_str = sys.stdin.read()
        if not input_str.strip():
            print(json.dumps({"success": False, "message": "Empty input"}))
            return

        data = json.loads(input_str)
        
        # Load model and encoders
        model = joblib.load(model_path)
        label_encoder = joblib.load(encoder_path)
        food_type_encoder = joblib.load(food_encoder_path)

        # Extract numeric features
        calories = float(data.get('calories', 0))
        protein_g = float(data.get('protein_g', 0))
        fat_g = float(data.get('fat_g', 0))
        carbs_g = float(data.get('carbs_g', 0))
        fiber_g = float(data.get('fiber_g', 0))
        sugar_g = float(data.get('sugar_g', 0))
        sodium_mg = float(data.get('sodium_mg', 0))

        # Handle category mapping
        raw_type = str(data.get('food_type', 'Other')).strip()
        classes = list(food_type_encoder.classes_)
        food_type = 'Other'
        for c in classes:
            if c.lower() in raw_type.lower() or raw_type.lower() in c.lower():
                food_type = c
                break

        food_type_encoded = food_type_encoder.transform([food_type])[0]

        input_df = pd.DataFrame([{
            'calories': calories,
            'protein_g': protein_g,
            'fat_g': fat_g,
            'carbs_g': carbs_g,
            'fiber_g': fiber_g,
            'sugar_g': sugar_g,
            'sodium_mg': sodium_mg,
            'food_type_encoded': food_type_encoded
        }])

        pred_idx = model.predict(input_df)[0]
        diet_label = label_encoder.inverse_transform([pred_idx])[0]

        probabilities = {}
        if hasattr(model, "predict_proba"):
            probs = model.predict_proba(input_df)[0]
            for idx, prob in enumerate(probs):
                class_name = label_encoder.inverse_transform([idx])[0]
                probabilities[class_name] = round(float(prob), 4)

        result = {
            "success": True,
            "prediction": diet_label,
            "probabilities": probabilities,
            "features_used": {
                "calories": calories,
                "protein_g": protein_g,
                "fat_g": fat_g,
                "carbs_g": carbs_g,
                "fiber_g": fiber_g,
                "sugar_g": sugar_g,
                "sodium_mg": sodium_mg,
                "food_type": food_type
            }
        }
        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == '__main__':
    main()
