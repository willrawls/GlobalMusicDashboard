from pathlib import Path

# Keep all generated test artifacts inside the project on Windows and CI.
Path(__file__).resolve().parents[1].joinpath('artifacts').mkdir(exist_ok=True)
