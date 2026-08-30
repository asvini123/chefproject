import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder
import joblib
import os

def score_to_label(score):
    """
    Converts numeric health_score into a category label.
    """
    if score == 60:
        return 'Poor'
    elif score == 65:
        return 'Good'
    elif score == 70:
        return 'Best'
    elif score == 75:
        return 'Excellent'
    else:
        return 'Unknown'

def clean_data(df):
    """
    Cleans the input food dataset: handles missing values.
    """
    df = df.copy()
    df.columns = [col.lower().strip() for col in df.columns]

    # Fill numeric NaNs with median values
    numeric_cols = ['calories', 'protein_g', 'fat_g', 'carbs_g', 'fiber_g', 'sugar_g', 'sodium_mg']
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
            df[col] = df[col].fillna(df[col].median())

    # Fill missing food_type
    if 'food_type' in df.columns:
        df['food_type'] = df['food_type'].fillna('Other').astype(str).str.strip()

    return df

def preprocess_features(df, save_encoders_path=None):
    """
    Preprocesses features and target for the Diet/Health Classifier.
    """
    df = clean_data(df)

    # Convert health_score (60/65/70/75) into label (Poor/Good/Best/Excellent)
    if 'health_score' not in df.columns:
        return None, None

    df['diet_label'] = df['health_score'].apply(score_to_label)

    # Encode food_type (categorical) into numbers
    food_type_encoder = LabelEncoder()
    df['food_type_encoded'] = food_type_encoder.fit_transform(df['food_type'])

    # Features: nutrition values + encoded food_type
    feature_cols = ['calories', 'protein_g', 'fat_g', 'carbs_g', 'fiber_g', 'sugar_g', 'sodium_mg', 'food_type_encoded']
    X = df[feature_cols]

    # Target label encoding (Poor/Good/Best/Excellent -> 0/1/2/3)
    label_encoder = LabelEncoder()
    y = label_encoder.fit_transform(df['diet_label'])

    # Save both encoders for later use in app.py
    if save_encoders_path:
        os.makedirs(save_encoders_path, exist_ok=True)
        joblib.dump(label_encoder, os.path.join(save_encoders_path, 'label_encoder.pkl'))
        joblib.dump(food_type_encoder, os.path.join(save_encoders_path, 'food_type_encoder.pkl'))

    return X, y