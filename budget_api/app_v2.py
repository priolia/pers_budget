#!/usr/bin/env python3
"""
Budget API Server v2.0
Рефакторинг с поддержкой разделения данных на:
- categories.json (категории с ID)
- data.json (траты с ID)
- config.json (настройки + пароль)
"""

import json
import os
import shutil
from datetime import datetime, timedelta
from functools import wraps

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from config import Config

app = Flask(__name__)

# Настройка CORS - детальная конфигурация для поддержки preflight запросов
CORS(app,
     origins=Config.ALLOWED_ORIGINS,
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     allow_headers=['Content-Type', 'X-API-Key', 'Authorization'],
     supports_credentials=False,
     max_age=3600)

# Убедимся что папки существуют
os.makedirs(Config.BACKUP_DIR, exist_ok=True)

# Пути к новым файлам данных
CATEGORIES_FILE = os.path.join(os.path.dirname(Config.DATA_FILE), 'categories.json')
CONFIG_FILE = os.path.join(os.path.dirname(Config.DATA_FILE), 'config.json')

# Версия API
API_VERSION = '2.0.0'


def require_api_key(f):
    """Декоратор для проверки API ключа"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('X-API-Key')
        if api_key != Config.API_KEY:
            return jsonify({'error': True, 'message': 'Неверный API ключ'}), 401
        return f(*args, **kwargs)
    return decorated_function


def get_version_info():
    """Получить информацию о версии"""
    return {
        'major': 2,
        'minor': 0,
        'patch': 0,
        'timestamp': datetime.now().isoformat()
    }


def load_json_file(file_path, default_data):
    """Загрузить JSON файл с обработкой ошибок"""
    if not os.path.exists(file_path):
        return default_data

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        app.logger.error(f'Ошибка чтения {file_path}: {e}')
        return default_data


def save_json_file(file_path, data, backup_prefix='backup'):
    """Сохранить JSON файл с созданием бэкапа"""
    try:
        # Создаем бэкап перед сохранением
        if os.path.exists(file_path):
            backup_file = os.path.join(
                Config.BACKUP_DIR,
                f'{backup_prefix}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
            )
            shutil.copy2(file_path, backup_file)
            app.logger.info(f'Создан бэкап: {backup_file}')

        # Сохраняем данные
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        # Очищаем старые бэкапы
        cleanup_old_backups(backup_prefix)

        return True
    except Exception as e:
        app.logger.error(f'Ошибка сохранения {file_path}: {e}')
        return False


def cleanup_old_backups(backup_prefix='backup'):
    """Удалить старые бэкапы (старше 30 дней)"""
    try:
        now = datetime.now()
        for filename in os.listdir(Config.BACKUP_DIR):
            if filename.startswith(f'{backup_prefix}_'):
                file_path = os.path.join(Config.BACKUP_DIR, filename)
                file_time = datetime.fromtimestamp(os.path.getmtime(file_path))
                age_days = (now - file_time).days

                if age_days > Config.BACKUP_RETENTION_DAYS:
                    os.remove(file_path)
                    app.logger.info(f'Удален старый бэкап: {filename}')
    except Exception as e:
        app.logger.error(f'Ошибка очистки бэкапов: {e}')


def load_categories():
    """Загрузить категории"""
    default = {
        'categories': [],
        'version': get_version_info(),
        'lastSync': datetime.now().isoformat()
    }
    return load_json_file(CATEGORIES_FILE, default)


def load_expenses():
    """Загрузить траты"""
    default = {
        'expenses': [],
        'version': get_version_info(),
        'lastSync': datetime.now().isoformat()
    }
    return load_json_file(Config.DATA_FILE, default)


def load_config():
    """Загрузить конфигурацию"""
    default = {
        'passwordHash': None,
        'periodStartDay': 25,
        'settings': {
            'rateEURtoUAH': 48.40,
            'rateEURtoBGN': 1.9558,
            'taxRate': 7.3,
            'limitFop': 2200,
            'limitCrypto': 1100,
            'incomeEuro': 3300,
            'totalIncomeUAH': 159720,
            'totalIncomeBGN': 6454.14,
            'lastRatesUpdate': None
        },
        'version': get_version_info(),
        'lastSync': datetime.now().isoformat()
    }
    return load_json_file(CONFIG_FILE, default)


# ============================================
# API ENDPOINTS - ПРОВЕРКА ЗДОРОВЬЯ
# ============================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Проверка работоспособности API"""
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.now().isoformat(),
        'version': API_VERSION
    })


# ============================================
# API ENDPOINTS - КАТЕГОРИИ
# ============================================

@app.route('/api/categories', methods=['GET'])
@require_api_key
def get_categories():
    """Получить все категории"""
    data = load_categories()
    return jsonify(data)


@app.route('/api/categories', methods=['POST'])
@require_api_key
def save_categories():
    """Сохранить категории"""
    try:
        data = request.get_json()

        # Валидация
        if not isinstance(data, dict) or 'categories' not in data:
            return jsonify({'error': True, 'message': 'Неверный формат данных'}), 400

        # Добавляем метаданные
        data['version'] = get_version_info()
        data['lastSync'] = datetime.now().isoformat()

        # Сохраняем
        if save_json_file(CATEGORIES_FILE, data, 'categories_backup'):
            return jsonify({
                'success': True,
                'message': 'Категории успешно сохранены',
                'timestamp': datetime.now().isoformat()
            })
        else:
            return jsonify({'error': True, 'message': 'Ошибка сохранения категорий'}), 500

    except Exception as e:
        app.logger.error(f'Ошибка в save_categories: {e}')
        return jsonify({'error': True, 'message': str(e)}), 500


# ============================================
# API ENDPOINTS - ТРАТЫ
# ============================================

@app.route('/api/expenses', methods=['GET'])
@require_api_key
def get_expenses():
    """Получить все траты"""
    data = load_expenses()
    return jsonify(data)


@app.route('/api/expenses', methods=['POST'])
@require_api_key
def save_expenses():
    """Сохранить траты"""
    try:
        data = request.get_json()

        # Валидация
        if not isinstance(data, dict) or 'expenses' not in data:
            return jsonify({'error': True, 'message': 'Неверный формат данных'}), 400

        # Добавляем метаданные
        data['version'] = get_version_info()
        data['lastSync'] = datetime.now().isoformat()

        # Сохраняем
        if save_json_file(Config.DATA_FILE, data, 'data_backup'):
            return jsonify({
                'success': True,
                'message': 'Траты успешно сохранены',
                'timestamp': datetime.now().isoformat()
            })
        else:
            return jsonify({'error': True, 'message': 'Ошибка сохранения трат'}), 500

    except Exception as e:
        app.logger.error(f'Ошибка в save_expenses: {e}')
        return jsonify({'error': True, 'message': str(e)}), 500


# ============================================
# API ENDPOINTS - КОНФИГУРАЦИЯ
# ============================================

@app.route('/api/config', methods=['GET'])
@require_api_key
def get_config():
    """Получить конфигурацию"""
    data = load_config()
    return jsonify(data)


@app.route('/api/config', methods=['POST'])
@require_api_key
def save_config():
    """Сохранить конфигурацию"""
    try:
        data = request.get_json()

        # Валидация
        if not isinstance(data, dict):
            return jsonify({'error': True, 'message': 'Неверный формат данных'}), 400

        # Добавляем метаданные
        data['version'] = get_version_info()
        data['lastSync'] = datetime.now().isoformat()

        # Сохраняем
        if save_json_file(CONFIG_FILE, data, 'config_backup'):
            return jsonify({
                'success': True,
                'message': 'Конфигурация успешно сохранена',
                'timestamp': datetime.now().isoformat()
            })
        else:
            return jsonify({'error': True, 'message': 'Ошибка сохранения конфигурации'}), 500

    except Exception as e:
        app.logger.error(f'Ошибка в save_config: {e}')
        return jsonify({'error': True, 'message': str(e)}), 500


# ============================================
# API ENDPOINTS - ОБРАТНАЯ СОВМЕСТИМОСТЬ
# ============================================

@app.route('/api/data', methods=['GET'])
@require_api_key
def get_data_legacy():
    """
    Получить все данные (legacy формат для обратной совместимости)
    Объединяет categories, expenses и config в один объект
    """
    try:
        categories_data = load_categories()
        expenses_data = load_expenses()
        config_data = load_config()

        # Формируем legacy формат
        legacy_data = {
            'categories': categories_data.get('categories', []),
            'expenses': expenses_data.get('expenses', []),
            'settings': config_data.get('settings', {}),
            'passwordHash': config_data.get('passwordHash'),
            'periodStartDay': config_data.get('periodStartDay', 25),
            'version': get_version_info(),
            'lastSync': datetime.now().isoformat()
        }

        return jsonify(legacy_data)

    except Exception as e:
        app.logger.error(f'Ошибка в get_data_legacy: {e}')
        return jsonify({'error': True, 'message': str(e)}), 500


@app.route('/api/data', methods=['POST'])
@require_api_key
def save_data_legacy():
    """
    Сохранить все данные (legacy формат)
    Разделяет данные на categories.json, data.json и config.json
    """
    try:
        data = request.get_json()

        # Валидация
        if not isinstance(data, dict):
            return jsonify({'error': True, 'message': 'Неверный формат данных'}), 400

        # Разделяем данные
        # 1. Категории
        if 'categories' in data:
            categories_data = {
                'categories': data['categories'],
                'version': get_version_info(),
                'lastSync': datetime.now().isoformat()
            }
            save_json_file(CATEGORIES_FILE, categories_data, 'categories_backup')

        # 2. Траты
        if 'expenses' in data:
            expenses_data = {
                'expenses': data['expenses'],
                'version': get_version_info(),
                'lastSync': datetime.now().isoformat()
            }
            save_json_file(Config.DATA_FILE, expenses_data, 'data_backup')

        # 3. Конфигурация
        config_data = {
            'passwordHash': data.get('passwordHash'),
            'periodStartDay': data.get('periodStartDay', 25),
            'settings': data.get('settings', {}),
            'version': get_version_info(),
            'lastSync': datetime.now().isoformat()
        }
        save_json_file(CONFIG_FILE, config_data, 'config_backup')

        return jsonify({
            'success': True,
            'message': 'Данные успешно сохранены',
            'timestamp': datetime.now().isoformat()
        })

    except Exception as e:
        app.logger.error(f'Ошибка в save_data_legacy: {e}')
        return jsonify({'error': True, 'message': str(e)}), 500


# ============================================
# API ENDPOINTS - ЭКСПОРТ И БЭКАПЫ
# ============================================

@app.route('/api/export', methods=['GET'])
@require_api_key
def export_data():
    """Экспорт всех данных в JSON файл для скачивания"""
    try:
        # Собираем все данные
        categories_data = load_categories()
        expenses_data = load_expenses()
        config_data = load_config()

        export_data = {
            'categories': categories_data.get('categories', []),
            'expenses': expenses_data.get('expenses', []),
            'config': {
                'periodStartDay': config_data.get('periodStartDay', 25),
                'settings': config_data.get('settings', {})
                # Пароль намеренно не экспортируем из соображений безопасности
            },
            'version': get_version_info(),
            'exportDate': datetime.now().isoformat()
        }

        # Создаем временный файл для экспорта
        export_file = os.path.join(
            Config.BACKUP_DIR,
            f'export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
        )

        with open(export_file, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2)

        return send_file(
            export_file,
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
        backups = {
            'categories': [],
            'data': [],
            'config': []
        }

        for filename in sorted(os.listdir(Config.BACKUP_DIR), reverse=True):
            file_path = os.path.join(Config.BACKUP_DIR, filename)
            backup_info = {
                'filename': filename,
                'date': datetime.fromtimestamp(os.path.getmtime(file_path)).isoformat(),
                'size': os.path.getsize(file_path)
            }

            if filename.startswith('categories_backup_'):
                backups['categories'].append(backup_info)
            elif filename.startswith('data_backup_'):
                backups['data'].append(backup_info)
            elif filename.startswith('config_backup_'):
                backups['config'].append(backup_info)

        return jsonify({'backups': backups})

    except Exception as e:
        app.logger.error(f'Ошибка получения списка бэкапов: {e}')
        return jsonify({'error': True, 'message': 'Ошибка получения бэкапов'}), 500


# ============================================
# ОБРАБОТКА ОШИБОК
# ============================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': True, 'message': 'Эндпоинт не найден'}), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': True, 'message': 'Внутренняя ошибка сервера'}), 500


# ============================================
# ЗАПУСК СЕРВЕРА
# ============================================

if __name__ == '__main__':
    print('=' * 50)
    print('🚀 Запуск Budget API Server v2.0')
    print('=' * 50)
    print(f'Host: {Config.API_HOST}')
    print(f'Port: {Config.API_PORT}')
    print(f'Categories file: {CATEGORIES_FILE}')
    print(f'Expenses file: {Config.DATA_FILE}')
    print(f'Config file: {CONFIG_FILE}')
    print(f'Backup dir: {Config.BACKUP_DIR}')
    print('=' * 50)

    app.run(
        host=Config.API_HOST,
        port=Config.API_PORT,
        debug=False
    )
