import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Порт API
    API_HOST = os.getenv('API_HOST', '0.0.0.0')
    API_PORT = int(os.getenv('API_PORT', 5000))

    # Безопасность
    API_KEY = os.getenv('API_KEY', 'my-secret-budget-key-2025')

    # CORS - разрешаем запросы с GitHub Pages
    ALLOWED_ORIGINS = os.getenv('ALLOWED_ORIGINS', 'https://priolia.github.io').split(',')

    # Пути к файлам
    DATA_FILE = os.path.join(os.path.dirname(__file__), 'data.json')
    BACKUP_DIR = os.path.join(os.path.dirname(__file__), 'backups')

    # Резервное копирование
    BACKUP_RETENTION_DAYS = int(os.getenv('BACKUP_RETENTION_DAYS', 30))
