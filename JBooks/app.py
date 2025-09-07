from flask import Flask, render_template, request, jsonify, g
import sqlite3
import requests
import re

app = Flask(__name__)
app.config['DATABASE'] = 'books.db'

def get_db():
    """Get a database connection"""
    if 'db' not in g:
        g.db = sqlite3.connect(app.config['DATABASE'])
        g.db.row_factory = sqlite3.Row

    return g.db

def init_db():
    """Initialize the database with the required table"""
    db = get_db()
    cursor = db.cursor()

    # Check if table already exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='books'")
    table_exists = cursor.fetchone()

    if not table_exists:
        cursor.execute('''
            CREATE TABLE books (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                isbn TEXT UNIQUE NOT NULL,
                location TEXT,
                author TEXT,
                summary TEXT,
                pages INTEGER,
                language TEXT,
                published_date TEXT,
                cover_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        db.commit()
        print("Database table created successfully")
    else:
        print("Database table already exists")

def close_db(e=None):
    """Close the database connection"""
    db = g.pop('db', None)
    if db is not None:
        db.close()

@app.before_request
def before_first_request():
    """Initialize database before first request"""
    init_db()

@app.teardown_appcontext
def teardown_db(exception):
    """Close database after each request"""
    close_db()

def fetch_book_details(isbn):
    """Fetch book details from Google Books API"""
    try:
        # Clean the ISBN (remove any non-digit characters except 'X')
        clean_isbn = re.sub(r'[^0-9X]', '', isbn.upper())

        # Try searching by ISBN
        response = requests.get(f'https://www.googleapis.com/books/v1/volumes?q=isbn:{clean_isbn}')
        data = response.json()

        if data.get('totalItems', 0) == 0:
            return None

        # Get the first result
        volume_info = data['items'][0]['volumeInfo']

        # Extract relevant information
        book_data = {
            'title': volume_info.get('title', 'Unknown Title'),
            'authors': ', '.join(volume_info.get('authors', ['Unknown Author'])),
            'publishedDate': volume_info.get('publishedDate', ''),
            'description': volume_info.get('description', 'No description available'),
            'pageCount': volume_info.get('pageCount', 0),
            'language': volume_info.get('language', ''),
            'thumbnail': volume_info.get('imageLinks', {}).get('thumbnail', '')

        }

        return book_data

    except Exception as e:
        print(f"Error fetching book details: {e}")
        return None



@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/entries', methods=['GET'])
def get_entries():
    try:
        db = get_db()
        cursor = db.cursor()
        cursor.execute('SELECT * FROM books ORDER BY created_at DESC')
        books = cursor.fetchall()

        books_list = []
        for book in books:
            books_list.append({
                'id': book['id'],
                'name': book['name'],
                'isbn': book['isbn'],
                'location': book['location'],
                'author': book['author'],
                'summary': book['summary'],
                'pages': book['pages'],
                'language': book['language'],
                'publishedDate': book['published_date'],
                'imageUrl': book['cover_url']
            })

        return jsonify(books_list)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/entries', methods=['POST'])
def add_entry():
    try:
        data = request.get_json()
        isbn = data.get('isbn')
        location = data.get('location', '')

        if not isbn:
            return jsonify({'error': 'ISBN is required'}), 400

        # Check if book already exists
        db = get_db()
        cursor = db.cursor()
        cursor.execute('SELECT * FROM books WHERE isbn = ?', (isbn,))
        existing_book = cursor.fetchone()

        if existing_book:
            return jsonify({'error': 'Book with this ISBN already exists'}), 409

        # Fetch book details from Google Books API
        book_data = fetch_book_details(isbn)

        if not book_data:
            return jsonify({'error': 'Could not find book with this ISBN'}), 404

        # Insert into database
        cursor.execute('''
            INSERT INTO books (name, isbn, location, author, summary, pages, language, published_date, cover_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            book_data['title'],
            isbn,
            location,
            book_data['authors'],
            book_data['description'],
            book_data['pageCount'],
            book_data['language'],
            book_data['publishedDate'],
            f'https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg'
        ))

        db.commit()
        book_id = cursor.lastrowid

        return jsonify({
            'message': 'Book added successfully',
            'id': book_id,
            'name': book_data['title']
        }), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/entries/isbn/<isbn>', methods=['DELETE'])
def delete_entry_by_isbn(isbn):
    try:
        db = get_db()
        cursor = db.cursor()

        # First check if the book exists by ISBN
        cursor.execute('SELECT id FROM books WHERE isbn = ?', (isbn,))
        book = cursor.fetchone()

        if not book:
            return jsonify({'error': 'Book not found with this ISBN'}), 404

        # Delete the book by ISBN
        cursor.execute('DELETE FROM books WHERE isbn = ?', (isbn,))
        db.commit()

        return jsonify({'message': 'Book deleted successfully by ISBN'}), 200

    except Exception as e:
        db.rollback()
        app.logger.error(f"Error deleting book with ISBN {isbn}: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/api/entries/<isbn>/location', methods=['PUT'])
def update_location(isbn):
    try:
        data = request.get_json()
        new_location = data.get('location', '')

        db = get_db()
        cursor = db.cursor()

        # Check if book exists
        cursor.execute('SELECT id FROM books WHERE isbn = ?', (isbn,))
        book = cursor.fetchone()

        if not book:
            return jsonify({'error': 'Book not found with this ISBN'}), 404

        # Update the location
        cursor.execute('UPDATE books SET location = ? WHERE isbn = ?', (new_location, isbn))
        db.commit()

        return jsonify({'message': 'Location updated successfully'}), 200

    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500



if __name__ == '__main__':
    # Ensure the database is initialized before running
    with app.app_context():
        init_db()
    app.run(debug=False) # Ste Debug to True in Debug Mode