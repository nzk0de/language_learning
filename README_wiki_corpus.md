# Wikipedia Corpus Processing for Language Learning

This project processes Wikipedia dump files to create a searchable corpus for language learning applications. It extracts articles, processes them with advanced NLP techniques using Stanza, and indexes them in Elasticsearch for efficient searching and analysis.

## Features

- **Wikipedia Dump Processing**: Handles compressed Wikipedia XML dumps (.xml.bz2)
- **NLP Processing**: Uses Stanza for tokenization, POS tagging, lemmatization, and dependency parsing
- **Elasticsearch Integration**: Creates searchable indexes with linguistic annotations
- **Memory Efficient**: Processes large dumps without loading everything into memory
- **Comprehensive Logging**: Detailed logs for monitoring and debugging
- **Configurable**: Command-line options for customization

## Prerequisites

### System Requirements
- Python 3.8+
- Elasticsearch 7.x or 8.x
- At least 4GB RAM (8GB+ recommended for larger dumps)
- 10-50GB free disk space (depending on dump size and target article count)

### Required Python Packages
```bash
pip install elasticsearch stanza mwparserfromhell
```

### Elasticsearch Setup
1. Install and start Elasticsearch:
   ```bash
   # On Ubuntu/Debian
   sudo apt update
   sudo apt install elasticsearch
   sudo systemctl start elasticsearch
   sudo systemctl enable elasticsearch
   
   # Or using Docker
   docker run -d --name elasticsearch -p 9200:9200 -e "discovery.type=single-node" elasticsearch:8.11.0
   ```

2. Verify Elasticsearch is running:
   ```bash
   curl http://localhost:9200
   ```

### Stanza Language Models
Download the required language model (example for German):
```python
import stanza
stanza.download('de')  # For German
stanza.download('en')  # For English
```

## Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd language_learning
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Download Wikipedia dumps:
   ```bash
   # Example: German Wikipedia dump (small version)
   wget https://dumps.wikimedia.org/dewiki/latest/dewiki-latest-pages-articles-multistream1.xml-p1p297012.bz2
   ```

## Usage

### Basic Usage
```bash
python create_wiki_corpus.py /path/to/dewiki-latest-pages-articles.xml.bz2
```

### Advanced Usage with Options
```bash
python create_wiki_corpus.py \
    /path/to/dewiki-latest-pages-articles.xml.bz2 \
    --max-articles 500 \
    --language de \
    --elasticsearch-host http://localhost:9200 \
    --index-name my_wiki_corpus
```

### Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `dump_file` | Path to Wikipedia dump file (.xml.bz2) | Required |
| `--max-articles` | Maximum number of articles to process | 100 |
| `--language` | Language code for Stanza (de, en, fr, etc.) | de |
| `--elasticsearch-host` | Elasticsearch connection string | http://localhost:9200 |
| `--index-name` | Name for the Elasticsearch index | wiki_docs |

## Architecture

### Data Flow
```
Wikipedia Dump → XML Parser → Article Extractor → Stanza NLP → Elasticsearch
     (.bz2)         ↓             ↓               ↓            ↓
                Raw XML      Title/Content    Tokens/POS    Searchable Index
```

### Elasticsearch Document Structure
Each processed article is stored as:
```json
{
  "title": "Article Title",
  "content": "Full article text...",
  "language": "de",
  "word_count": 1250,
  "sentence_count": 45,
  "created_at": "2025-09-14T10:30:00",
  "tokens": [
    {
      "text": "Das",
      "lemma": "der",
      "pos": "DET",
      "deprel": "det",
      "sentence_id": 0,
      "token_id": 1
    }
  ]
}
```

### Key Components

#### WikiCorpusProcessor Class
Main class that orchestrates the entire pipeline:
- `initialize_elasticsearch()`: Sets up ES connection and index
- `initialize_stanza()`: Loads NLP models
- `extract_article_from_xml()`: Parses XML and extracts clean text
- `process_with_stanza()`: Performs NLP analysis
- `index_article()`: Stores processed data in Elasticsearch
- `process_dump()`: Main processing loop

## Example Usage in Code

```python
from create_wiki_corpus import WikiCorpusProcessor

# Initialize processor
processor = WikiCorpusProcessor(
    dump_file_path="dewiki-sample.xml.bz2",
    language="de",
    index_name="german_wiki"
)

# Setup
processor.initialize_elasticsearch()
processor.initialize_stanza()

# Process articles
stats = processor.process_dump(max_articles=50)
print(f"Processed {stats['articles_indexed']} articles")
```

## Searching the Corpus

Once indexed, you can search the corpus using Elasticsearch queries:

```python
from elasticsearch import Elasticsearch

es = Elasticsearch("http://localhost:9200")

# Simple text search
result = es.search(
    index="wiki_docs",
    body={
        "query": {
            "match": {
                "content": "machine learning"
            }
        }
    }
)

# Search by linguistic features
result = es.search(
    index="wiki_docs",
    body={
        "query": {
            "nested": {
                "path": "tokens",
                "query": {
                    "bool": {
                        "must": [
                            {"term": {"tokens.lemma": "sein"}},
                            {"term": {"tokens.pos": "VERB"}}
                        ]
                    }
                }
            }
        }
    }
)
```

## Performance and Optimization

### Processing Speed
- **Small dumps** (~1GB): ~100 articles in 5-10 minutes
- **Medium dumps** (~5GB): ~1000 articles in 1-2 hours
- **Large dumps** (~20GB): Limited by memory and CPU

### Memory Usage
- **Base memory**: ~2GB for Stanza models
- **Per article**: ~10-50MB during processing
- **Elasticsearch**: Additional 1-2GB recommended

### Optimization Tips
1. **Increase RAM**: More memory = faster processing
2. **SSD Storage**: Faster I/O for Elasticsearch
3. **Batch Processing**: Process in chunks for very large dumps
4. **Index Tuning**: Adjust ES settings for bulk indexing

## Troubleshooting

### Common Issues

1. **Elasticsearch Connection Failed**
   ```bash
   # Check if ES is running
   curl http://localhost:9200
   # Start ES if needed
   sudo systemctl start elasticsearch
   ```

2. **Stanza Model Not Found**
   ```python
   import stanza
   stanza.download('de')  # Download missing language model
   ```

3. **Memory Errors**
   - Reduce `--max-articles`
   - Increase system memory
   - Close other applications

4. **Disk Space Issues**
   - Check available space: `df -h`
   - Clean up old indexes: `curl -X DELETE http://localhost:9200/old_index`

### Logging
Logs are written to both console and `wiki_corpus.log` file:
```bash
# Monitor logs in real-time
tail -f wiki_corpus.log
```

## Integration with Language Learning App

The processed corpus integrates with the main language learning application:

1. **Search Examples**: Find usage examples for words
2. **Context Learning**: See words in authentic contexts
3. **Difficulty Analysis**: Use linguistic features for level assessment
4. **Translation Practice**: Compare multilingual articles

## File Structure
```
language_learning/
├── create_wiki_corpus.py          # Main processing script
├── README.md                      # This file
├── requirements.txt               # Python dependencies
├── wiki_corpus.log               # Processing logs
└── language_app/                 # Main application
    ├── app/
    │   ├── es_utils.py           # Elasticsearch utilities
    │   └── main.py               # FastAPI application
    └── ...
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- **Stanza**: Stanford NLP library
- **Elasticsearch**: Search and analytics engine  
- **mwparserfromhell**: MediaWiki markup parser
- **Wikipedia**: Source of linguistic data
