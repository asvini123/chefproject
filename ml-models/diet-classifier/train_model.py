import os
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier
from sklearn.metrics import classification_report, accuracy_score
import joblib

from preprocess import preprocess_features

def train():
    print("🚀 Starting Diet Classifier Model Training...")

    current_dir = os.path.dirname(os.path.abspath(__file__))
    dataset_path = os.path.join(current_dir, 'healthy_foods_database.csv')
    models_dir = os.path.join(current_dir, 'saved_models')

    os.makedirs(models_dir, exist_ok=True)

    if not os.path.exists(dataset_path):
        print(f"❌ Error: Dataset file not found at {dataset_path}")
        return

    df = pd.read_csv(dataset_path)
    print(f"📋 Loaded dataset with {len(df)} rows.")

    X, y = preprocess_features(df, save_encoders_path=models_dir)

    if y is None:
        print("❌ Error: 'health_score' column not found in dataset.")
        return

    X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.15, random_state=42, stratify=y
)

    # class_weight='balanced' - imbalance handle panna (75 score rare ah irukku)
    model = XGBClassifier(n_estimators=500, max_depth=10, learning_rate=0.05, random_state=42)

    print("🏋️ Training model...")
    model.fit(X_train, y_train)

    predictions = model.predict(X_test)
    accuracy = accuracy_score(y_test, predictions)
    print(f"✅ Training Complete. Model Accuracy: {accuracy * 100:.2f}%")

    le = joblib.load(os.path.join(models_dir, 'label_encoder.pkl'))
    print("\n📊 Classification Report:")
    print(classification_report(y_test, predictions, target_names=le.classes_))

    model_save_path = os.path.join(models_dir, 'diet_classifier_model.pkl')
    joblib.dump(model, model_save_path)
    print(f"💾 Saved model to {model_save_path}")

if __name__ == '__main__':
    train()