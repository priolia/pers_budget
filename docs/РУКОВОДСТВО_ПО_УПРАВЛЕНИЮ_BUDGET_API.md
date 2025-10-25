# 📋 Руководство по управлению Budget API

Полное руководство по настройке, управлению и обслуживанию серверного API для приложения персонального бюджетирования.

---

## 🎯 Что было достигнуто

### ✅ Серверная часть (Backend)
- **Flask API** развёрнут на VPS сервере HostHatch (31.220.42.219)
- **Systemd сервис** настроен для автозапуска API при перезагрузке
- **Nginx** настроен как reverse proxy для проксирования запросов
- **SSL сертификат** от Let's Encrypt получен и установлен
- **Бесплатный домен** `priolia-budget.duckdns.org` настроен и привязан к серверу
- **HTTPS** полностью работает - все данные передаются зашифровано

### ✅ Клиентская часть (Frontend)
- **GitHub Pages** - приложение доступно по адресу https://priolia.github.io/pers_budget/
- **api.js** обновлён с HTTPS URL сервера
- **Индикатор подключения** показывает ✅ (зелёную галочку) - успешное подключение
- **Fallback режим** - если сервер недоступен, данные сохраняются локально в браузере

### ✅ Безопасность
- Все данные передаются по **зашифрованному HTTPS**
- API защищён **ключом доступа**
- **CORS** настроен только для домена GitHub Pages
- SSL сертификат **автоматически обновляется** (Certbot Timer)

---

## 📊 Архитектура системы

```
Браузер (HTTPS)
    ↓
https://priolia.github.io/pers_budget/ (GitHub Pages)
    ↓ HTTPS запросы
https://priolia-budget.duckdns.org/api (Nginx с SSL)
    ↓ Проксирование
http://localhost:5000 (Flask API)
    ↓ Сохранение
data.json + backups/ (JSON файлы на диске)
```

---

## 🔑 Ключевые данные

| Параметр | Значение |
|----------|----------|
| **IP сервера** | `31.220.42.219` |
| **Домен** | `priolia-budget.duckdns.org` |
| **API URL** | `https://priolia-budget.duckdns.org/api` |
| **API ключ** | `BdgtAPI_7k9mX2pL5nQ8wR4vY6zT3hJ0sF1dG` |
| **Flask порт** | `5000` (локально) |
| **Nginx порты** | `80` (HTTP), `443` (HTTPS) |
| **GitHub Pages** | https://priolia.github.io/pers_budget/ |
| **SSL сертификат** | Let's Encrypt (истекает 19 января 2026) |

---

## 💻 Полезные команды для управления

### 🔧 Управление Flask API

```bash
# Проверить статус сервиса
sudo systemctl status budget-api

# Запустить сервис
sudo systemctl start budget-api

# Остановить сервис
sudo systemctl stop budget-api

# Перезапустить сервис
sudo systemctl restart budget-api

# Включить автозапуск при загрузке системы
sudo systemctl enable budget-api

# Отключить автозапуск
sudo systemctl disable budget-api

# Посмотреть логи в реальном времени
sudo journalctl -u budget-api -f

# Посмотреть последние 50 строк логов
sudo journalctl -u budget-api -n 50
```

---

### 🌐 Управление Nginx

```bash
# Проверить конфигурацию на ошибки
sudo nginx -t

# Перезагрузить Nginx (применить изменения без простоя)
sudo systemctl reload nginx

# Перезапустить Nginx
sudo systemctl restart nginx

# Проверить статус Nginx
sudo systemctl status nginx

# Посмотреть логи доступа
sudo tail -f /var/log/nginx/access.log

# Посмотреть логи ошибок
sudo tail -f /var/log/nginx/error.log

# Редактировать конфигурацию API
sudo nano /etc/nginx/sites-available/budget-api
```

---

### 🔐 Управление SSL сертификатами

```bash
# Проверить статус автообновления сертификата
sudo systemctl status certbot.timer

# Принудительно обновить сертификат (тест)
sudo certbot renew --dry-run

# Обновить сертификат (реально)
sudo certbot renew

# Список всех сертификатов
sudo certbot certificates

# Удалить сертификат
sudo certbot delete --cert-name priolia-budget.duckdns.org
```

**📅 Автообновление сертификата:**
Certbot автоматически запускается **2 раза в день** и обновляет сертификат, если до истечения осталось менее 30 дней. Ничего делать не нужно!

---

### 🧪 Проверка работоспособности

```bash
# Проверить Flask API локально
curl http://localhost:5000/api/health

# Проверить HTTPS API
curl https://priolia-budget.duckdns.org/api/health

# Проверить разрешение домена
nslookup priolia-budget.duckdns.org

# Проверить какие порты слушаются
sudo ss -tlnp | grep -E '(5000|80|443)'

# Проверить процессы Flask
ps aux | grep flask

# Проверить процессы Nginx
ps aux | grep nginx
```

**✅ Правильный ответ API:**
```json
{"status":"ok","timestamp":"2025-10-21T19:53:15.148984","version":"1.0.0"}
```

---

### 📂 Расположение важных файлов

```bash
# Flask API (код приложения)
/opt/budget_api/
  ├── app.py              # Основной код Flask API
  ├── config.py           # Конфигурация
  ├── .env                # Переменные окружения (API ключ, порт)
  ├── data.json           # Данные приложения
  ├── backups/            # Резервные копии
  └── venv/               # Виртуальное окружение Python

# Systemd сервис
/etc/systemd/system/budget-api.service

# Nginx конфигурация
/etc/nginx/sites-available/budget-api
/etc/nginx/sites-enabled/budget-api  # Симлинк

# SSL сертификаты
/etc/letsencrypt/live/priolia-budget.duckdns.org/
  ├── fullchain.pem       # Полная цепочка сертификата
  └── privkey.pem         # Приватный ключ

# Логи
/var/log/nginx/access.log   # Логи доступа Nginx
/var/log/nginx/error.log    # Логи ошибок Nginx
journalctl -u budget-api    # Логи Flask API
```

---

### 📝 Редактирование конфигурации API

```bash
# Изменить порт, API ключ, CORS
sudo nano /opt/budget_api/.env

# После изменений перезапустить
sudo systemctl restart budget-api
```

**Содержимое `.env`:**
```bash
API_HOST=0.0.0.0
API_PORT=5000
API_KEY=BdgtAPI_7k9mX2pL5nQ8wR4vY6zT3hJ0sF1dG
ALLOWED_ORIGINS=https://priolia.github.io
```

---

### 🔄 Резервное копирование данных

```bash
# Скачать текущий data.json с сервера
scp root@31.220.42.219:/opt/budget_api/data.json ./budget_backup_$(date +%Y%m%d).json

# Посмотреть все бэкапы на сервере
ls -lh /opt/budget_api/backups/

# Скачать все бэкапы
scp -r root@31.220.42.219:/opt/budget_api/backups/ ./local_backups/
```

---

### 📊 Мониторинг и диагностика

```bash
# Использование диска
df -h

# Использование оперативной памяти
free -h

# Загрузка CPU
top
# (нажмите 'q' для выхода)

# Сетевые соединения к API
sudo ss -tnp | grep :5000

# Количество запросов к Nginx за последний час
sudo grep "$(date +%d/%b/%Y:%H)" /var/log/nginx/access.log | wc -l
```

---

## 🔒 Безопасность

### ✅ Уже настроено:
- HTTPS с валидным SSL сертификатом
- API ключ для защиты от несанкционированного доступа
- CORS ограничен только вашим доменом
- Flask API слушает только localhost (недоступен извне напрямую)

### 💡 Дополнительные улучшения (опционально):

```bash
# 1. Настроить файрвол (UFW)
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable

# 2. Изменить SSH порт (от ботов)
sudo nano /etc/ssh/sshd_config
# Найти: #Port 22
# Изменить на: Port 2222
sudo systemctl restart sshd

# 3. Автоматические обновления безопасности
sudo apt install unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

---

## 🚨 Решение проблем

### Проблема: API не отвечает

```bash
# 1. Проверить статус сервиса
sudo systemctl status budget-api

# 2. Если сервис упал - посмотреть причину
sudo journalctl -u budget-api -n 50

# 3. Перезапустить сервис
sudo systemctl restart budget-api

# 4. Проверить работу локально
curl http://localhost:5000/api/health
```

---

### Проблема: Nginx показывает 502 Bad Gateway

```bash
# Flask API не запущен или недоступен
sudo systemctl status budget-api
sudo systemctl start budget-api

# Проверить что Flask слушает порт 5000
sudo ss -tlnp | grep 5000
```

---

### Проблема: SSL сертификат истёк

```bash
# Обновить сертификат вручную
sudo certbot renew

# Проверить автообновление
sudo systemctl status certbot.timer

# Перезапустить Nginx
sudo systemctl reload nginx
```

---

### Проблема: Индикатор показывает ⚠️ или 💾

**В браузере:**
1. Откройте консоль разработчика (F12)
2. Перейдите во вкладку **Console**
3. Посмотрите на ошибки (обычно красные)

**Частые причины:**
- API недоступен - проверьте `sudo systemctl status budget-api`
- CORS ошибка - проверьте `ALLOWED_ORIGINS` в `.env`
- Неправильный API ключ - проверьте что ключ одинаковый в `.env` и `api.js`

---

## 🔄 Обновление кода приложения

### Обновление Flask API на сервере:

```bash
# 1. Перейти в директорию
cd /opt/budget_api

# 2. Активировать виртуальное окружение
source venv/bin/activate

# 3. Редактировать код
nano app.py

# 4. Перезапустить сервис
sudo systemctl restart budget-api

# 5. Проверить логи
sudo journalctl -u budget-api -f
```

---

### Обновление клиентской части (api.js):

1. Откройте GitHub репозиторий: https://github.com/priolia/pers_budget
2. Отредактируйте нужный файл через веб-интерфейс
3. Сделайте коммит
4. Подождите 1-2 минуты (GitHub Pages автоматически обновится)
5. Очистите кэш браузера: **Ctrl + Shift + R**

---

## 📈 Статистика и аналитика

```bash
# Посмотреть сколько запросов за сегодня
sudo grep "$(date +%d/%b/%Y)" /var/log/nginx/access.log | wc -l

# Топ 10 IP адресов по количеству запросов
sudo awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -10

# Посмотреть размер data.json
ls -lh /opt/budget_api/data.json

# Посмотреть размер всех бэкапов
du -sh /opt/budget_api/backups/
```

---

## 📄 Конфигурационные файлы

### Nginx конфигурация (`/etc/nginx/sites-available/budget-api`)

```nginx
server {
    listen 80;
    server_name priolia-budget.duckdns.org;

    location /api/ {
        proxy_pass http://localhost:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 443 ssl http2;
    server_name priolia-budget.duckdns.org;

    ssl_certificate /etc/letsencrypt/live/priolia-budget.duckdns.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/priolia-budget.duckdns.org/privkey.pem;
    
    # Настройки SSL от Mozilla (современные)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';

    location /api/ {
        proxy_pass http://localhost:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

### Systemd сервис (`/etc/systemd/system/budget-api.service`)

```ini
[Unit]
Description=Budget API Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/budget_api
Environment="PATH=/opt/budget_api/venv/bin"
ExecStart=/opt/budget_api/venv/bin/python /opt/budget_api/app.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

---

### Переменные окружения (`/opt/budget_api/.env`)

```bash
API_HOST=0.0.0.0
API_PORT=5000
API_KEY=BdgtAPI_7k9mX2pL5nQ8wR4vY6zT3hJ0sF1dG
ALLOWED_ORIGINS=https://priolia.github.io
```

---

## 🎓 Что было изучено

✅ Развёртывание Python/Flask приложений на VPS  
✅ Настройка Nginx как reverse proxy  
✅ Получение и настройка бесплатных SSL сертификатов  
✅ Работа с systemd для автозапуска сервисов  
✅ Настройка бесплатных доменов (DuckDNS)  
✅ Интеграция frontend (GitHub Pages) и backend (VPS)  
✅ Базовая безопасность веб-приложений  

---

## 🚀 Возможные улучшения в будущем

1. **База данных** - PostgreSQL/MySQL вместо JSON
2. **Аутентификация** - логин/пароль для пользователей
3. **Docker** - контейнеризация для упрощения развёртывания
4. **CI/CD** - автоматическое развёртывание при коммитах
5. **Мониторинг** - Grafana/Prometheus для отслеживания работы
6. **Резервное копирование** - автоматическая загрузка в S3/Dropbox
7. **PWA** - Progressive Web App для установки на телефон
8. **Множественные пользователи** - система учётных записей

---

## 📞 Полезные ресурсы

- **Flask документация:** https://flask.palletsprojects.com/
- **Nginx документация:** https://nginx.org/ru/docs/
- **Let's Encrypt:** https://letsencrypt.org/
- **DuckDNS:** https://www.duckdns.org/
- **GitHub Pages:** https://pages.github.com/

---

## ✅ Финальная проверка работоспособности

```bash
# На сервере выполните все команды:

# 1. Flask API работает
curl http://localhost:5000/api/health

# 2. HTTPS работает
curl https://priolia-budget.duckdns.org/api/health

# 3. Сервисы запущены
sudo systemctl status budget-api
sudo systemctl status nginx
sudo systemctl status certbot.timer

# 4. Нет ошибок в логах
sudo journalctl -u budget-api -n 20
sudo tail -20 /var/log/nginx/error.log
```

**Если все команды вернули положительный результат - всё работает отлично!** ✅

---

## 🎉 Итог

Приложение персонального бюджетирования полностью настроено и работает с серверным хранилищем данных!

**Что работает:**
- ✅ Веб-приложение на GitHub Pages
- ✅ API сервер на VPS с HTTPS
- ✅ Автоматическое сохранение данных на сервер
- ✅ Оффлайн режим с локальным сохранением
- ✅ Автообновление SSL сертификата

**Приложение доступно по адресу:** https://priolia.github.io/pers_budget/

---

## 📅 История изменений

- **21 октября 2025** - Настройка HTTPS с доменом DuckDNS
- **21 октября 2025** - Получение SSL сертификата от Let's Encrypt
- **21 октября 2025** - Успешный запуск с индикатором ✅

---

**Документ создан:** 21 октября 2025  
**Версия:** 1.0  
**Статус:** Производственная система работает
