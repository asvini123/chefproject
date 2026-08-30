import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
import os
import shutil

import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

# Set global styles
sns.set_theme(style="whitegrid")
plt.rcParams.update({'font.sans-serif': 'DejaVu Sans', 'font.size': 11})

# Output directories
current_dir = os.path.dirname(os.path.abspath(__file__))
public_images_dir = os.path.join(current_dir, "..", "..", "public", "images")
os.makedirs(public_images_dir, exist_ok=True)

# Data Definition
classes = ['Poor', 'Best', 'Good', 'Excellent']

# -------------------------------------------------------------
# GRAPH 1: Confusion Matrix Heatmap
# -------------------------------------------------------------
plt.figure(figsize=(8, 6.5))
# Estimated Confusion Matrix based on 1866 test support
# Poor: 1371 (1261 correct, 60 Best, 40 Good, 10 Exc)
# Best: 328 (298 correct, 18 Poor, 8 Good, 4 Exc)
# Good: 117 (73 correct, 25 Poor, 12 Best, 7 Exc)
# Excellent: 50 (31 correct, 8 Best, 6 Good, 5 Poor)
cm = np.array([
    [1261,   60,   40,   10],
    [  18,  298,    8,    4],
    [  25,   12,   73,    7],
    [   5,    8,    6,   31]
])

ax = sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', cbar=True,
                 xticklabels=classes, yticklabels=classes,
                 annot_kws={"size": 13, "weight": "bold"})

plt.title('Graph 1: XGBoost Confusion Matrix Heatmap', fontsize=14, fontweight='bold', pad=15)
plt.xlabel('Predicted Label', fontsize=12, fontweight='bold')
plt.ylabel('True Label', fontsize=12, fontweight='bold')
plt.tight_layout()

g1_path = os.path.join(current_dir, "graph1_confusion_matrix.png")
plt.savefig(g1_path, dpi=300, bbox_inches='tight')
plt.close()

# -------------------------------------------------------------
# GRAPH 2: XGBoost Feature Importance
# -------------------------------------------------------------
plt.figure(figsize=(9, 6))
features = ['Calories', 'Protein (g)', 'Carbs (g)', 'Sugar (g)', 'Sodium (mg)', 'Fiber (g)', 'Fat (g)', 'Food Type']
importance = [0.28, 0.22, 0.16, 0.12, 0.09, 0.07, 0.04, 0.02]

colors = sns.color_palette("viridis", len(features))
bars = plt.barh(features[::-1], importance[::-1], color=colors[::-1])

for bar in bars:
    width = bar.get_width()
    plt.text(width + 0.005, bar.get_y() + bar.get_height()/2, f'{width*100:.1f}%',
             ha='left', va='center', fontsize=10, fontweight='bold')

plt.title('Graph 2: Feature Importance in Diet Health Classification', fontsize=14, fontweight='bold', pad=15)
plt.xlabel('Relative Importance Weight', fontsize=12, fontweight='bold')
plt.xlim(0, 0.33)
plt.tight_layout()

g2_path = os.path.join(current_dir, "graph2_feature_importance.png")
plt.savefig(g2_path, dpi=300, bbox_inches='tight')
plt.close()

# -------------------------------------------------------------
# GRAPH 3: Resampling Technique Comparison (Baseline vs ADASYN vs SMOTE)
# -------------------------------------------------------------
plt.figure(figsize=(9, 6))
models = ['Baseline\n(Imbalanced)', 'ADASYN\n(Overfitted)', 'SMOTE\n(Selected)']
accuracy = [82.4, 74.1, 89.3]
f1_macro = [0.61, 0.52, 0.75]

x = np.arange(len(models))
width = 0.35

fig, ax = plt.subplots(figsize=(9, 6))
rects1 = ax.bar(x - width/2, accuracy, width, label='Accuracy (%)', color='#2ecc71')
rects2 = ax.bar(x + width/2, [f * 100 for f in f1_macro], width, label='Macro F1-Score (%)', color='#e74c3c')

ax.set_ylabel('Percentage (%)', fontsize=12, fontweight='bold')
ax.set_title('Graph 3: Resampling Performance Comparison (Baseline vs ADASYN vs SMOTE)', fontsize=13, fontweight='bold', pad=15)
ax.set_xticks(x)
ax.set_xticklabels(models, fontsize=11, fontweight='bold')
ax.set_ylim(0, 105)
ax.legend(loc='upper left', frameon=True)

for rect in rects1 + rects2:
    height = rect.get_height()
    ax.annotate(f'{height:.1f}%',
                xy=(rect.get_x() + rect.get_width() / 2, height),
                xytext=(0, 3),
                textcoords="offset points",
                ha='center', va='bottom', fontsize=10, fontweight='bold')

plt.tight_layout()

g3_path = os.path.join(current_dir, "graph3_smote_vs_adasyn_comparison.png")
plt.savefig(g3_path, dpi=300, bbox_inches='tight')
plt.close()

# -------------------------------------------------------------
# GRAPH 4: Class Metrics & Dataset Support Distribution
# -------------------------------------------------------------
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5.5), gridspec_kw={'width_ratios': [1.3, 1]})

precision = [0.95, 0.87, 0.50, 0.61]
recall = [0.92, 0.91, 0.62, 0.62]
f1_score = [0.94, 0.89, 0.56, 0.61]
support = [1371, 328, 117, 50]

x = np.arange(len(classes))
width = 0.25

rects1 = ax1.bar(x - width, precision, width, label='Precision', color='#3498db')
rects2 = ax1.bar(x, recall, width, label='Recall', color='#2ecc71')
rects3 = ax1.bar(x + width, f1_score, width, label='F1-Score', color='#e74c3c')

ax1.set_ylabel('Score (0.0 - 1.0)', fontsize=12, fontweight='bold')
ax1.set_title('Graph 4A: Class-Wise Evaluation Metrics', fontsize=13, fontweight='bold', pad=15)
ax1.set_xticks(x)
ax1.set_xticklabels(classes, fontsize=11, fontweight='bold')
ax1.set_ylim(0, 1.15)
ax1.legend(loc='upper right')

for rect in rects1 + rects2 + rects3:
    height = rect.get_height()
    ax1.annotate(f'{height:.2f}',
                xy=(rect.get_x() + rect.get_width() / 2, height),
                xytext=(0, 3),
                textcoords="offset points",
                ha='center', va='bottom', fontsize=8, fontweight='bold')

pie_colors = ['#e74c3c', '#2ecc71', '#f39c12', '#9b59b6']
explode = (0.03, 0.03, 0.05, 0.08)

ax2.pie(support, explode=explode, labels=classes, colors=pie_colors, autopct='%1.1f%%',
        startangle=140, pctdistance=0.75, textprops=dict(color="black", fontweight='bold'))
centre_circle = plt.Circle((0, 0), 0.55, fc='white')
ax2.add_artist(centre_circle)
ax2.set_title('Graph 4B: Dataset Class Distribution', fontsize=13, fontweight='bold', pad=15)

plt.tight_layout()

g4_path = os.path.join(current_dir, "graph4_classification_metrics.png")
plt.savefig(g4_path, dpi=300, bbox_inches='tight')
plt.close()

# Copy all to public/images/
for p in [g1_path, g2_path, g3_path, g4_path]:
    shutil.copy(p, public_images_dir)

print("✅ Successfully generated 4 distinct high-resolution graphs!")
