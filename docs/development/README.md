# 💰 Budget API Server

Простой API сервер для хранения данных приложения персонального бюджетирования.

## 📁 Структура

```
budget_api/
├── app.py              # Основное приложение Flask
├── config.py           # Конфигурация
├── requirements.txt    # Зависимости Python
├── .env               # Переменные окружения (НЕ коммитить!)
├── data.json          # Данные (создается автоматически)
└── backups/           # Автоматические бэкапы
```

## 🚀 Установка на сервере

### 1. Загрузить файлы через WinSCP

Загрузите всю папку `budget_api` в домашнюю директорию на сервере.

### 2. Подключиться по SSH

В WinSCP нажмите `Ctrl+P` для открытия консоли.

### 3. Установить зависимости

```bash
cd budget_api
pip3 install -r requirements.txt
```

### 4. Запустить сервер (тест)

```bash
python3 app.py
```

Вы должны увидеть:
```
==================================================
🚀 Запуск Budget API Server
==================================================
Host: 0.0.0.0
Port: 5000
==================================================
```

### 5. Проверить работу

Откройте в браузере (замените YOUR_SERVER_IP на IP вашего сервера):
```
http://YOUR_SERVER_IP:5000/api/health
```

Должны увидеть:
```json
{"status": "ok", "timestamp": "...", "version": "1.0.0"}
```

## 🔧 Настройка автозапуска

### Создать systemd сервис

1. Создайте файл сервиса:
```bash
sudo nano /etc/systemd/system/budget-api.service
```

2. Вставьте содержимое (замените USERNAME на ваше имя пользователя):
```ini
[Unit]
Description=Budget API Server
After=network.target

[Service]
Type=simple
User=USERNAME
WorkingDirectory=/home/USERNAME/budget_api
Environment="PATH=/usr/bin:/usr/local/bin"
ExecStart=/usr/bin/python3 /home/USERNAME/budget_api/app.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

3. Сохраните (Ctrl+X, Y, Enter)

4. Активируйте сервис:
```bash
sudo systemctl daemon-reload
sudo systemctl enable budget-api
sudo systemctl start budget-api
```

5. Проверьте статус:
```bash
sudo systemctl status budget-api
```

## 📝 Управление сервисом

```bash
# Запустить
sudo systemctl start budget-api

# Остановить
sudo systemctl stop budget-api

# Перезапустить
sudo systemctl restart budget-api

# Посмотреть логи
sudo journalctl -u budget-api -f
```

## 🔐 Безопасность

### Изменить API ключ

1. Откройте файл `.env`:
```bash
nano .env
```

2. Измените строку:
```
API_KEY=ваш-секретный-ключ-здесь
```

3. Перезапустите сервис:
```bash
sudo systemctl restart budget-api
```

### Настроить файрвол (опционально)

```bash
# Разрешить порт 5000
sudo ufw allow 5000

# Проверить статус
sudo ufw status
```

## 📦 Бэкапы

Бэкапы создаются автоматически при каждом сохранении данных.

### Где находятся бэкапы:
```
/home/USERNAME/budget_api/backups/
```

### Просмотр бэкапов через API:
```
GET http://YOUR_SERVER_IP:5000/api/backups
Headers: X-API-Key: your-api-key
```

### Ручное создание бэкапа:
```bash
cp data.json backups/manual_backup_$(date +%Y%m%d_%H%M%S).json
```

## 🌐 API Endpoints

### Health Check
```
GET /api/health
Ответ: {"status": "ok", "timestamp": "...", "version": "1.0.0"}
```

### Получить данные
```
GET /api/data
Headers: X-API-Key: your-api-key
Ответ: {categories: [...], expenses: [...], settings: {...}}
```

### Сохранить данные
```
POST /api/data
Headers:
  Content-Type: application/json
  X-API-Key: your-api-key
Body: {categories: [...], expenses: [...], settings: {...}}
```

### Экспорт данных
```
GET /api/export
Headers: X-API-Key: your-api-key
Ответ: Скачивание JSON файла
```

### Список бэкапов
```
GET /api/backups
Headers: X-API-Key: your-api-key
Ответ: {backups: [{filename: "...", date: "...", size: ...}, ...]}
```

## ❓ Проблемы и решения

### Порт 5000 занят
Измените порт в `.env`:
```
API_PORT=8000
```

### Ошибка доступа к файлам
Проверьте права:
```bash
chmod 755 /home/USERNAME/budget_api
chmod 644 /home/USERNAME/budget_api/data.json
```

### Сервис не запускается
Проверьте логи:
```bash
sudo journalctl -u budget-api -n 50
```

## 📞 Поддержка

При возникновении проблем проверьте:
1. Логи сервиса: `sudo journalctl -u budget-api -f`
2. Доступность порта: `netstat -tulpn | grep 5000`
3. Права на файлы: `ls -la`
