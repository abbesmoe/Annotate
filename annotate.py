from flask import Flask, render_template
import csv

# Starts the web app
app = Flask(__name__)

class_map = {}
with open("static/csv/map_new.csv") as csvfile:
    reader = csv.reader(csvfile)
    class_map = {row[0]:row[1] for row in reader}

classes = []
for cat,supercat in class_map.items():
    c = supercat + " - " + cat
    classes.append(c)

# Home page
@app.route("/")
def home():
    return render_template("annotate.html", classes=classes)

# Runs the web app
if __name__ == "__main__":
    app.run(debug=True, host='127.0.0.1', port=5000)