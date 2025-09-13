pip install -e .
python -m spacy download de_core_news_sm
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload