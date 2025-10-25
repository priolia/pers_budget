# ⚡ Быстрый старт (5 минут)

Если не хотите читать длинную инструкцию - вот самое главное:

## 📦 1. Загрузить на сервер

В WinSCP перетащите папку `budget_api` в домашнюю директорию.

## 🔧 2. Установить и запустить

В консоли WinSCP (`Ctrl+P`):

```bash
cd budget_api
pip3 install -r requirements.txt
python3 app.py
```

Должны увидеть:
```
🚀 Запуск Budget API Server
Host: 0.0.0.0
Port: 5000
```

## 🌐 3. Проверить

Откройте в браузере (замените IP):
```
http://YOUR_SERVER_IP:5000/api/health
```

Должны увидеть `{"status": "ok"}`

## ✏️ 4. Настроить клиент

В файле `api.js` измените (строки 16-18):

```javascript
API_BASE_URL: 'http://YOUR_SERVER_IP:5000/api',
API_KEY: 'ваш-секретный-ключ',
```

Тот же ключ должен быть в `budget_api/.env`!

## 🚀 5. Загрузить на GitHub

```bash
git add .
git commit -m "Add API integration"
git push
```

## ✅ 6. Проверить

Откройте https://priolia.github.io/pers_budget/

В правом верхнем углу должна быть **✅** (подключено к серверу).

---

## 🔄 Автозапуск (бонус)

Чтобы сервер запускался автоматически:

```bash
# Создать файл (замените USERNAME!)
sudo nano /etc/systemd/system/budget-api.service
```

Вставьте:
```ini
[Unit]
Description=Budget API Server
After=network.target

[Service]
Type=simple
User=USERNAME
WorkingDirectory=/home/USERNAME/budget_api
ExecStart=/usr/bin/python3 /home/USERNAME/budget_api/app.py
Restart=always

[Install]
WantedBy=multi-user.target
```

Сохраните (`Ctrl+X`, `Y`, `Enter`) и выполните:

```bash
sudo systemctl daemon-reload
sudo systemctl enable budget-api
sudo systemctl start budget-api
```

Проверьте:
```bash
sudo systemctl status budget-api
```

---

## ❓ Проблемы?

- **Оффлайн ⚠️** - проверьте что сервер запущен: `sudo systemctl status budget-api`
- **Ошибка API ключа** - ключи в `api.js` и `.env` должны совпадать
- **Не работает** - смотрите полную инструкцию в `DEPLOYMENT.md`

---

**Вот и всё! Готово за 5 минут!** 🎉
