# 🚀 Инструкция по переходу на API v2.0

## ⚠️ ВАЖНО: На сервере запущена старая версия API (v1.0.0)

Сейчас на вашем сервере работает **app.py (v1.0.0)**, но нужно запустить **app_v2.py (v2.0.0)** для работы с новым фронтендом.

---

## 📋 Что было исправлено в этом коммите:

1. ✅ **Исправлена настройка CORS в app_v2.py**
   - Добавлена поддержка preflight запросов (OPTIONS)
   - Настроены заголовки: `Content-Type`, `X-API-Key`, `Authorization`
   - Установлен `max_age=3600` для кеширования preflight

2. ✅ **Исправлена ошибка в js/utils/export.js**
   - Правильный доступ к config через `getConfig()`

3. ✅ **Удален дублирующий файл api.js**

---

## 🔧 Шаги для перезапуска API v2.0 на сервере

### Вариант 1: SSH подключение к серверу

```bash
# 1. Подключитесь к серверу по SSH
ssh your_user@your_server_ip

# 2. Перейдите в папку с проектом
cd /path/to/budget_api

# 3. Обновите код из git
git pull origin claude/refactor-budget-app-v2-011CUPcVUfYZoigAJKPNCK5v

# 4. Найдите процесс старого API
ps aux | grep "python.*app.py"

# Вы увидите что-то вроде:
# user  1234  0.0  1.2  123456  12345 ?  S  10:00  0:01 python3 app.py

# 5. Остановите старый процесс (замените 1234 на реальный PID)
kill 1234

# 6. Запустите новый API v2.0 в фоне
nohup python3 app_v2.py > app_v2.log 2>&1 &

# 7. Проверьте что API работает
curl http://localhost:5000/api/health

# Должно вернуть:
# {"status":"ok","timestamp":"...","version":"2.0.0"}

# 8. Проверьте логи
tail -f app_v2.log
```

---

### Вариант 2: Использование systemd (рекомендуется для production)

Если на сервере используется systemd service:

```bash
# 1. Подключитесь к серверу
ssh your_user@your_server_ip

# 2. Обновите код
cd /path/to/budget_api
git pull origin claude/refactor-budget-app-v2-011CUPcVUfYZoigAJKPNCK5v

# 3. Откройте service файл для редактирования
sudo nano /etc/systemd/system/budget-api.service

# 4. Измените ExecStart на app_v2.py:
# Было:
#   ExecStart=/usr/bin/python3 /path/to/budget_api/app.py
# Стало:
#   ExecStart=/usr/bin/python3 /path/to/budget_api/app_v2.py

# 5. Сохраните файл (Ctrl+O, Enter, Ctrl+X)

# 6. Перезагрузите systemd конфигурацию
sudo systemctl daemon-reload

# 7. Перезапустите сервис
sudo systemctl restart budget-api

# 8. Проверьте статус
sudo systemctl status budget-api

# 9. Проверьте версию API
curl http://localhost:5000/api/health
```

---

### Вариант 3: Docker (если используется)

```bash
# 1. Подключитесь к серверу
ssh your_user@your_server_ip

# 2. Перейдите в папку проекта
cd /path/to/budget_api

# 3. Обновите код
git pull origin claude/refactor-budget-app-v2-011CUPcVUfYZoigAJKPNCK5v

# 4. Пересоберите контейнер
docker-compose down
docker-compose up -d --build

# 5. Проверьте логи
docker-compose logs -f
```

---

## ✅ Проверка что всё работает

После перезапуска API выполните проверки:

### 1. Проверка версии API

```bash
curl https://priolia-budget.duckdns.org/api/health
```

Должно вернуть:
```json
{
  "status": "ok",
  "timestamp": "2025-10-23T...",
  "version": "2.0.0"
}
```

### 2. Проверка CORS

```bash
curl -I -X OPTIONS https://priolia-budget.duckdns.org/api/categories \
  -H "Origin: https://priolia.github.io" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: X-API-Key"
```

В ответе должны быть заголовки:
```
Access-Control-Allow-Origin: https://priolia.github.io
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, X-API-Key, Authorization
```

### 3. Проверка в браузере

1. Откройте https://priolia.github.io/pers_budget/
2. Откройте консоль браузера (F12)
3. Обновите страницу с очисткой кеша (Ctrl+Shift+R)

Вы должны увидеть:
```
📄 DOM загружен
🚀 Запуск Budget App v2.0...
✅ API доступен: 2.0.0    <-- ВАЖНО: должно быть 2.0.0!
📥 Загрузка данных...
✅ Загружено: X категорий, Y трат
✅ Приложение инициализировано
```

**Не должно быть ошибок CORS!**

---

## 🔍 Диагностика проблем

### Проблема: API не отвечает

```bash
# Проверьте запущен ли процесс
ps aux | grep "python.*app_v2.py"

# Проверьте логи
tail -n 50 app_v2.log

# Проверьте порт 5000
netstat -tuln | grep 5000
# или
ss -tuln | grep 5000
```

### Проблема: Ошибки CORS в браузере

1. Убедитесь что API v2.0 запущен (версия 2.0.0)
2. Проверьте файл `.env` в `budget_api/`:
   ```bash
   cat budget_api/.env
   ```
   Должно быть:
   ```
   ALLOWED_ORIGINS=https://priolia.github.io
   ```

3. Если используется несколько доменов, разделите запятой:
   ```
   ALLOWED_ORIGINS=https://priolia.github.io,http://localhost:8000
   ```

### Проблема: API возвращает 401 Unauthorized

Проверьте что API ключ совпадает:
- В `budget_api/.env`: `API_KEY=...`
- В `js/config.js`: `API_KEY: '...'`

---

## 📊 Что изменилось в API v2.0

### Новые endpoints:

```
GET  /api/health        - Статус API (версия 2.0.0)
GET  /api/categories    - Получить категории с ID
POST /api/categories    - Сохранить категории с ID
GET  /api/expenses      - Получить траты с ID
POST /api/expenses      - Сохранить траты с ID
GET  /api/config        - Получить настройки + пароль
POST /api/config        - Сохранить настройки + пароль
GET  /api/export        - Экспорт всех данных
GET  /api/backups       - Список бэкапов
```

### Разделение данных:

- **categories.json** - категории с уникальными ID
- **data.json** - траты с уникальными ID
- **config.json** - настройки + хеш пароля

### Автоматические бэкапы:

- Создаются при каждом сохранении
- Хранятся 30 дней
- Раздельные для категорий и трат

---

## 🆘 Нужна помощь?

Если возникли проблемы:

1. Проверьте логи API: `tail -f app_v2.log`
2. Проверьте консоль браузера (F12)
3. Проверьте что версия API = 2.0.0
4. Убедитесь что CORS настроен правильно

---

## 📝 Следующие шаги после успешного запуска

1. ✅ Убедитесь что API v2.0 работает (версия 2.0.0)
2. ✅ Откройте сайт и проверьте отсутствие ошибок CORS
3. ✅ Выполните миграцию данных в консоли: `await BudgetApp.migrate()`
4. ✅ Проверьте основные функции:
   - Экспорт данных
   - Импорт данных
   - Синхронизация
   - Обновление курсов валют

---

**Автор:** Claude
**Дата:** 2025-10-23
**Ветка:** claude/refactor-budget-app-v2-011CUPcVUfYZoigAJKPNCK5v
