#!/usr/bin/env python3
"""
Простой API для приложения персонального бюджетирования
Хранит данные в JSON файле
"""

import json
import os
import shutil
from datetime import datetime
from functools import wraps

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from config import Config

app = Flask(__name__)

# Настройка CORS
CORS(app, origins=Config.ALLOWED_ORIGINS)

# Убедимся что папки существуют
os.makedirs(Config.BACKUP_DIR, exist_ok=True)


def require_api_key(f):
    """Декоратор для проверки API ключа"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('X-API-Key')
        if api_key != Config.API_KEY:
            return jsonify({'error': True, 'message': 'Неверный API ключ'}), 401
        return f(*args, **kwargs)
    return decorated_function


def load_data():
    """Загрузить данные из JSON файла"""
    if not os.path.exists(Config.DATA_FILE):
        return {
            'categories': [],
            'expenses': [],
            'settings': {
                'rateEURtoUAH': 41.5,
                'rateEURtoBGN': 1.96,
                'taxRate': 7.3,
                'limitFop': 2200,
                'limitCrypto': 1100,
                'incomeEuro': 3300,
                'lastRatesUpdate': None
            }
        }

    try:
        with open(Config.DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        app.logger.error(f'Ошибка чтения данных: {e}')
        return None


def save_data(data):
    """Сохранить данные в JSON файл"""
    try:
        # Создаем бэкап перед сохранением
        if os.path.exists(Config.DATA_FILE):
            backup_file = os.path.join(
                Config.BACKUP_DIR,
                f'data_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
            )
            shutil.copy2(Config.DATA_FILE, backup_file)
            app.logger.info(f'Создан бэкап: {backup_file}')

        # Сохраняем данные
        with open(Config.DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        # Очищаем старые бэкапы
        cleanup_old_backups()

        return True
    except Exception as e:
        app.logger.error(f'Ошибка сохранения данных: {e}')
        return False


def cleanup_old_backups():
    """Удалить старые бэкапы"""
    try:
        now = datetime.now()
        for filename in os.listdir(Config.BACKUP_DIR):
            if filename.startswith('data_backup_'):
                file_path = os.path.join(Config.BACKUP_DIR, filename)
                file_time = datetime.fromtimestamp(os.path.getmtime(file_path))
                age_days = (now - file_time).days

                if age_days > Config.BACKUP_RETENTION_DAYS:
                    os.remove(file_path)
                    app.logger.info(f'Удален старый бэкап: {filename}')
    except Exception as e:
        app.logger.error(f'Ошибка очистки бэкапов: {e}')


@app.route('/api/health', methods=['GET'])
def health_check():
    """Проверка работоспособности API"""
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.now().isoformat(),
        'version': '1.0.0'
    })


@app.route('/api/data', methods=['GET'])
@require_api_key
def get_data():
    """Получить все данные"""
    data = load_data()
    if data is None:
        return jsonify({'error': True, 'message': 'Ошибка загрузки данных'}), 500

    return jsonify(data)


@app.route('/api/data', methods=['POST'])
@require_api_key
def save_data_endpoint():
    """Сохранить все данные"""
    try:
        data = request.get_json()

        # Валидация базовой структуры
        if not isinstance(data, dict):
            return jsonify({'error': True, 'message': 'Неверный формат данных'}), 400

        required_keys = ['categories', 'expenses', 'settings']
        for key in required_keys:
            if key not in data:
                return jsonify({'error': True, 'message': f'Отсутствует обязательное поле: {key}'}), 400

        # Сохраняем
        if save_data(data):
            return jsonify({
                'success': True,
                'message': 'Данные успешно сохранены',
                'timestamp': datetime.now().isoformat()
            })
        else:
            return jsonify({'error': True, 'message': 'Ошибка сохранения данных'}), 500

    except Exception as e:
        app.logger.error(f'Ошибка в save_data_endpoint: {e}')
        return jsonify({'error': True, 'message': str(e)}), 500


@app.route('/api/export', methods=['GET'])
@require_api_key
def export_data():
    """Экспорт данных в JSON файл для скачивания"""
    if not os.path.exists(Config.DATA_FILE):
        return jsonify({'error': True, 'message': 'Нет данных для экспорта'}), 404

    try:
        return send_file(
            Config.DATA_FILE,
            mimetype='application/json',
            as_attachment=True,
            download_name=f'budget_export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
        )
    except Exception as e:
        app.logger.error(f'Ошибка экспорта: {e}')
        return jsonify({'error': True, 'message': 'Ошибка экспорта данных'}), 500


@app.route('/api/backups', methods=['GET'])
@require_api_key
def list_backups():
    """Список доступных бэкапов"""
    try:
        backups = []
        for filename in sorted(os.listdir(Config.BACKUP_DIR), reverse=True):
            if filename.startswith('data_backup_'):
                file_path = os.path.join(Config.BACKUP_DIR, filename)
                backups.append({
                    'filename': filename,
                    'date': datetime.fromtimestamp(os.path.getmtime(file_path)).isoformat(),
                    'size': os.path.getsize(file_path)
                })

        return jsonify({'backups': backups})
    except Exception as e:
        app.logger.error(f'Ошибка получения списка бэкапов: {e}')
        return jsonify({'error': True, 'message': 'Ошибка получения бэкапов'}), 500


@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': True, 'message': 'Эндпоинт не найден'}), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': True, 'message': 'Внутренняя ошибка сервера'}), 500


if __name__ == '__main__':
    print('=' * 50)
    print('🚀 Запуск Budget API Server')
    print('=' * 50)
    print(f'Host: {Config.API_HOST}')
    print(f'Port: {Config.API_PORT}')
    print(f'Data file: {Config.DATA_FILE}')
    print(f'Backup dir: {Config.BACKUP_DIR}')
    print('=' * 50)

    app.run(
        host=Config.API_HOST,
        port=Config.API_PORT,
        debug=False
    )
