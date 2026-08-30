import matplotlib.pyplot as plt
import numpy as np
import os

def generate_charts():
    # Set style
    plt.style.use('seaborn-v0_8-whitegrid' if 'seaborn-v0_8-whitegrid' in plt.style.available else 'default')
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 6), gridspec_kw={'width_ratios': [1.3, 1]})

    # Data from classification report
    classes = ['Poor', 'Best', 'Good', 'Excellent']
    precision = [0.95, 0.87, 0.50, 0.61]
    recall = [0.92, 0.91, 0.62, 0.62]
    f1_score = [0.94, 0.89, 0.56, 0.61]
    support = [1371, 328, 117, 50]

    # --- 1. Bar Chart: Precision, Recall, F1-Score ---
    x = np.arange(len(classes))
    width = 0.25

    rects1 = ax1.bar(x - width, precision, width, label='Precision', color='#3498db')
    rects2 = ax1.bar(x, recall, width, label='Recall', color='#2ecc71')
    rects3 = ax1.bar(x + width, f1_score, width, label='F1-Score', color='#e74c3c')

    ax1.set_ylabel('Score (0.0 - 1.0)', fontsize=12, fontweight='bold')
    ax1.set_title('Diet Classifier Model Performance Metrics by Class', fontsize=14, fontweight='bold', pad=15)
    ax1.set_xticks(x)
    ax1.set_xticklabels(classes, fontsize=11, fontweight='bold')
    ax1.set_ylim(0, 1.15)
    ax1.legend(loc='upper right', frameon=True)

    # Add values above bars
    for rect in rects1 + rects2 + rects3:
        height = rect.get_height()
        ax1.annotate(f'{height:.2f}',
                    xy=(rect.get_x() + rect.get_width() / 2, height),
                    xytext=(0, 3),
                    textcoords="offset points",
                    ha='center', va='bottom', fontsize=9, fontweight='bold')

    # Add overall accuracy badge
    ax1.text(0.03, 0.93, 'Overall Accuracy: 89.34%', transform=ax1.transAxes,
             fontsize=11, fontweight='bold', color='#2c3e50',
             bbox=dict(boxstyle='round,pad=0.5', facecolor='#f1c40f', alpha=0.8))

    # --- 2. Donut Chart: Class Support Distribution ---
    colors = ['#e74c3c', '#2ecc71', '#f39c12', '#9b59b6']
    explode = (0.03, 0.03, 0.05, 0.08)

    wedges, texts, autotexts = ax2.pie(
        support,
        explode=explode,
        labels=classes,
        colors=colors,
        autopct='%1.1f%%',
        pctdistance=0.75,
        startangle=140,
        textprops=dict(color="black", fontweight='bold')
    )

    centre_circle = plt.Circle((0, 0), 0.55, fc='white')
    ax2.add_artist(centre_circle)
    ax2.set_title('Dataset Distribution (Total Test Support: 1866)', fontsize=14, fontweight='bold', pad=15)

    for i, a in enumerate(autotexts):
        a.set_text(f"{a.get_text()}\n({support[i]} samples)")
        a.set_fontsize(9)

    plt.tight_layout()

    current_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(current_dir, "diet_model_analysis_chart.png")
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    print(f"✅ Chart saved successfully at: {output_path}")

if __name__ == '__main__':
    generate_charts()
