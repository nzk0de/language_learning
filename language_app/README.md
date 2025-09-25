pip install -e .
source venv/bin/activate && cd language_app && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
cd language-ui && npm start