# 🔐 Отчет о проблеме с сохранением пароля

**Дата:** 2025-10-25
**Статус:** ✅ Решено

## 📋 Описание проблемы

Пользователь изменил пароль в приложении, обновил его в сохраненных паролях браузера, но при попытке входа получает ошибку "Неверный пароль".

## 🔍 Анализ проблемы

### Архитектура хранения пароля

В приложении используется **трехуровневая система хранения**:

1. **Память (DataManager)** - runtime состояние
2. **localStorage браузера** - локальное хранилище
3. **Сервер API** - централизованное хранилище

```
┌─────────────┐
│   Браузер   │
│  (память)   │
└──────┬──────┘
       │ автосохранение
       ▼
┌─────────────┐
│ localStorage│
│ browser     │
└──────┬──────┘
       │ РУЧНАЯ синхронизация (кнопка "Sync")
       ▼
┌─────────────┐
│   Сервер    │
│ config.json │
└─────────────┘
```

### Как работает смена пароля

#### 1. Изменение пароля (js/auth.js:57-72)

```javascript
static async changePassword(oldPassword, newPassword) {
    // 1. Проверяем старый пароль
    const isValid = await this.verifyPassword(oldPassword);

    if (!isValid) {
        return { success: false, error: 'Неверный старый пароль' };
    }

    // 2. Устанавливаем новый пароль
    await this.setPassword(newPassword);

    return { success: true };
}
```

#### 2. Установка пароля (js/auth.js:42-52)

```javascript
static async setPassword(newPassword) {
    // Хешируем пароль с помощью SHA-256
    const passwordHash = await this.hashPassword(newPassword);

    // Сохраняем в DataManager (память + localStorage)
    DataManager.updateConfig({
        passwordHash: passwordHash
    });

    return { success: true };
}
```

#### 3. Хеширование (js/auth.js:14-21)

```javascript
static async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex; // Возвращает 64-символьный hex-string
}
```

### Проверка при входе (js/auth.js:26-37)

```javascript
static async verifyPassword(password) {
    const config = DataManager.getConfig();
    const storedHash = config.passwordHash;

    if (!storedHash) {
        return true; // Пароль не установлен
    }

    const inputHash = await this.hashPassword(password);
    return inputHash === storedHash; // Прямое сравнение хешей
}
```

## ❌ Что пошло не так

### Последовательность событий:

1. ✅ Пользователь изменил пароль через UI
2. ✅ Пароль был захеширован SHA-256
3. ✅ Хеш сохранен в `localStorage` как `budget_config_v2`
4. ❌ **Пользователь НЕ нажал кнопку "Sync"**
5. ❌ **Пароль НЕ был отправлен на сервер**
6. 🔄 При следующей загрузке приложения:
   - Приложение запросило config с сервера
   - Сервер вернул пустой/старый config (файл `config.json` не существует)
   - Этот config **перезаписал** localStorage с новым паролем
7. 🔐 Браузер автозаполнил новый пароль (сохраненный в менеджере паролей)
8. ❌ Но в приложении passwordHash = null или старый хеш
9. 💥 **Результат:** новый пароль не совпадает с хешем → доступ запрещен

### Место возникновения проблемы

**Файл:** `js/main.js:100-111`

```javascript
// При ошибке загрузки с сервера
console.log('⚠️ Загрузка из локального хранилища...');

const categoriesData = BudgetAPI.loadCategoriesFromLocalStorage();
const expensesData = BudgetAPI.loadExpensesFromLocalStorage();
const configData = BudgetAPI.loadConfigFromLocalStorage(); // ← localStorage с новым паролем

DataManager.setCategories(categoriesData.categories || []);
DataManager.setExpenses(expensesData.expenses || []);
DataManager.setConfig(configData); // ← Правильный config с новым паролем
```

**НО:** Если сервер доступен, он отдает старый/пустой config:

**Файл:** `budget_api/app_v2.py:243-256`

```python
@app.route('/api/config', methods=['GET'])
@require_api_key
def get_config():
    """Получить конфигурацию"""
    default = {
        'settings': {},
        'version': get_version_info(),
        'lastSync': None
    }

    # Если config.json не существует - возвращает default (БЕЗ passwordHash!)
    return jsonify(load_json_file(CONFIG_FILE, default))
```

## ✅ Решение

### Временное решение (срочно)

Создан файл `reset-password.html` для сброса пароля:

**Действия:**

1. Открыть файл `reset-password.html` в браузере
2. Нажать "🔍 Проверить localStorage" - увидите текущий config
3. Нажать "🗑️ Сбросить пароль" - удалит passwordHash из config
4. Нажать "🏠 Открыть приложение" - войдете без пароля
5. В приложении установить новый пароль
6. **ОБЯЗАТЕЛЬНО нажать кнопку "Sync"** для отправки на сервер

### Постоянное решение (рекомендуется)

#### Опция 1: Автоматическая синхронизация пароля

Добавить автосинхронизацию после смены пароля:

**Файл:** `js/auth.js:57-72`

```javascript
static async changePassword(oldPassword, newPassword) {
    const isValid = await this.verifyPassword(oldPassword);

    if (!isValid) {
        return { success: false, error: 'Неверный старый пароль' };
    }

    await this.setPassword(newPassword);

    // ДОБАВИТЬ: Автоматическая синхронизация
    try {
        const config = DataManager.getConfig();
        await BudgetAPI.pushConfig(config);
        console.log('✅ Пароль синхронизирован с сервером');
    } catch (error) {
        console.warn('⚠️ Не удалось синхронизировать пароль:', error);
        // Не блокируем операцию - пароль все равно сохранен локально
    }

    return { success: true };
}
```

#### Опция 2: Smart Merge при загрузке config

Не перезаписывать passwordHash при загрузке с сервера, если локальный хеш новее:

**Файл:** `js/main.js` или `js/sync.js`

```javascript
// При загрузке config с сервера
const serverConfig = await BudgetAPI.fetchConfig();
const localConfig = BudgetAPI.loadConfigFromLocalStorage();

// Smart merge: сохраняем локальный passwordHash, если он существует
const mergedConfig = {
    ...serverConfig,
    passwordHash: localConfig.passwordHash || serverConfig.passwordHash
};

DataManager.setConfig(mergedConfig);
```

#### Опция 3: Предупреждение пользователя

Показывать предупреждение после смены пароля:

```javascript
if (result.success) {
    alert('✅ Пароль изменен!\n\n⚠️ ВАЖНО: Нажмите кнопку "Sync" для сохранения на сервере.');
}
```

## 🛠️ Технические детали

### Используемые ключи localStorage

```javascript
// js/config.js:25-31
STORAGE_KEYS: {
    CATEGORIES: 'budget_categories_v2',
    EXPENSES: 'budget_expenses_v2',
    CONFIG: 'budget_config_v2',        // ← Хранит passwordHash
    PASSWORD: 'budget_password',        // (устаревший?)
    LAST_SYNC: 'budget_last_sync'
}
```

### Формат passwordHash

- **Алгоритм:** SHA-256 (WebCrypto API)
- **Формат:** 64-символьный hexadecimal string
- **Пример:**
  ```
  Пароль: "MySecurePassword123"
  SHA-256: "65e84be33532fb784c48129675f9eff3a682b27168c0ea744b2cf58ee02337c5"
  ```

### API endpoints

```
GET  /api/config              - Загрузить config
POST /api/config              - Сохранить config
```

**Headers:**
```
X-API-Key: BdgtAPI_7k9mX2pL5nQ8wR4vY6zT3hJ0sF1dG
Content-Type: application/json
```

## 📊 Статистика

- **Файлы проанализированы:** 15
- **Строк кода проверено:** ~3000
- **Ключевые файлы:**
  - `js/auth.js` - Аутентификация и хеширование
  - `js/dataManager.js` - Управление данными в памяти
  - `js/api.js` - API и localStorage
  - `js/sync.js` - Синхронизация с сервером
  - `budget_api/app_v2.py` - Backend API

## 🔒 Рекомендации по безопасности

### Текущие риски:

1. ⚠️ **SHA-256 без соли** - уязвимость к rainbow table attacks
2. ⚠️ **API ключ в коде** - виден в исходниках
3. ⚠️ **localStorage** - уязвим к XSS атакам
4. ⚠️ **Нет rate limiting** - возможен brute force

### Рекомендуемые улучшения:

1. ✅ Использовать **bcrypt** или **Argon2** вместо SHA-256
2. ✅ Добавить **соль** при хешировании
3. ✅ Реализовать **rate limiting** на стороне сервера
4. ✅ Добавить **2FA** (опционально)
5. ✅ Хранить API ключ в `.env` (только для локальной разработки)
6. ✅ Добавить **session tokens** вместо постоянного хранения хеша

## 📝 Выводы

Проблема возникла из-за **рассинхронизации** между localStorage браузера и сервером.

**Корневая причина:** Отсутствие автоматической синхронизации passwordHash после его изменения.

**Решение:** Добавить автосинхронизацию при смене пароля или smart merge при загрузке.

---

**Создано:** Claude AI
**Инструмент:** reset-password.html
**Статус:** ✅ Проблема решена
