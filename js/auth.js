/**
 * Модуль аутентификации через Google OAuth
 */

import { CONFIG } from './config.js';

export class AuthManager {
    static isAuthenticated = false;
    static googleClientId = null;

    /**
     * Получить сохранённый Google-токен из sessionStorage
     */
    static getToken() {
        return sessionStorage.getItem(CONFIG.STORAGE_KEYS.GOOGLE_TOKEN);
    }

    /**
     * Сохранить Google-токен
     */
    static setToken(token) {
        sessionStorage.setItem(CONFIG.STORAGE_KEYS.GOOGLE_TOKEN, token);
    }

    /**
     * Удалить токен (выход)
     */
    static clearToken() {
        sessionStorage.removeItem(CONFIG.STORAGE_KEYS.GOOGLE_TOKEN);
    }

    /**
     * Загрузить Google Client ID с сервера
     */
    static async fetchGoogleClientId() {
        try {
            const response = await fetch(`${CONFIG.API.BASE_URL}/auth/google-client-id`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            this.googleClientId = data.google_client_id;
            console.log('✅ Google Client ID получен');
            return this.googleClientId;
        } catch (error) {
            console.error('❌ Не удалось получить Google Client ID:', error);
            return null;
        }
    }

    /**
     * Инициализировать Google Identity Services и нарисовать кнопку
     */
    static async initGoogleSignIn() {
        // Получаем Client ID с сервера
        const clientId = await this.fetchGoogleClientId();

        if (!clientId) {
            this.showError('Не удалось загрузить настройки авторизации. Проверьте подключение к серверу.');
            return false;
        }

        // Ждём, пока загрузится Google Identity Services скрипт
        const waitForGoogle = (timeoutMs = 5000) => new Promise((resolve, reject) => {
            const startedAt = Date.now();
            const tick = () => {
                if (window.google && window.google.accounts && window.google.accounts.id) {
                    resolve();
                } else if (Date.now() - startedAt > timeoutMs) {
                    reject(new Error('Google Identity Services не загрузился'));
                } else {
                    setTimeout(tick, 100);
                }
            };
            tick();
        });

        try {
            await waitForGoogle();
        } catch (error) {
            console.error('❌', error.message);
            this.showError('Google не загрузился. Проверьте подключение к интернету и блокировщики рекламы.');
            return false;
        }

        // Инициализация Google Sign-In
        window.google.accounts.id.initialize({
            client_id: clientId,
            callback: (response) => this.handleGoogleResponse(response),
            auto_select: false,
            cancel_on_tap_outside: false
        });

        // Рисуем кнопку
        const buttonContainer = document.getElementById('g_id_signin');
        if (buttonContainer) {
            window.google.accounts.id.renderButton(buttonContainer, {
                type: 'standard',
                theme: 'outline',
                size: 'large',
                text: 'signin_with',
                shape: 'rectangular',
                logo_alignment: 'left',
                width: 280
            });
        }

        return true;
    }

    /**
     * Обработчик ответа от Google (приходит после успешного входа)
     */
    static async handleGoogleResponse(response) {
        if (!response || !response.credential) {
            this.showError('Не удалось получить токен от Google');
            return;
        }

        const token = response.credential;
        this.setToken(token);

        // Проверяем токен на сервере, одновременно проверяем что email в whitelist
        try {
            const authCheck = await fetch(`${CONFIG.API.BASE_URL}/categories`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (authCheck.status === 401 || authCheck.status === 403) {
                // Email не в whitelist или токен невалиден
                this.clearToken();
                this.showError('Ваш email не имеет доступа к этому приложению.');
                return;
            }

            if (!authCheck.ok) {
                this.clearToken();
                this.showError(`Ошибка сервера: ${authCheck.status}`);
                return;
            }

            // Всё ок — запускаем приложение
            this.isAuthenticated = true;
            this.hideLoginScreen();

            if (window.BudgetApp && window.BudgetApp.init) {
                await window.BudgetApp.init();
            }

        } catch (error) {
            console.error('❌ Ошибка проверки токена:', error);
            this.clearToken();
            this.showError('Не удалось связаться с сервером. Попробуйте позже.');
        }
    }

    /**
     * Выход
     */
    static logout() {
        this.clearToken();
        this.isAuthenticated = false;

        // Отключаем автологин Google
        if (window.google && window.google.accounts && window.google.accounts.id) {
            window.google.accounts.id.disableAutoSelect();
        }

        console.log('✅ Выход выполнен');

        // Перезагружаем страницу для чистого старта
        window.location.reload();
    }

    /**
     * Показать сообщение об ошибке
     */
    static showError(message) {
        const loginError = document.getElementById('login-error');
        if (loginError) {
            loginError.textContent = message;
            loginError.classList.remove('hidden');
        }
        console.error('Ошибка входа:', message);
    }

    /**
     * Скрыть сообщение об ошибке
     */
    static hideError() {
        const loginError = document.getElementById('login-error');
        if (loginError) {
            loginError.classList.add('hidden');
        }
    }

    /**
     * Показать экран логина
     */
    static showLoginScreen() {
        const loginScreen = document.getElementById('login-screen');
        const app = document.getElementById('app');

        if (loginScreen) {
            loginScreen.classList.remove('hidden');
        }

        if (app) {
            app.classList.add('hidden');
        }
    }

    /**
     * Скрыть экран логина
     */
    static hideLoginScreen() {
        const loginScreen = document.getElementById('login-screen');
        const app = document.getElementById('app');

        if (loginScreen) {
            loginScreen.classList.add('hidden');
        }

        if (app) {
            app.classList.remove('hidden');
        }
    }

    /**
     * Проверить аутентификацию при запуске.
     * Если токен есть в sessionStorage — пробуем его использовать.
     * Если нет или невалиден — показываем экран логина с кнопкой Google.
     */
    static async checkAuth() {
        const token = this.getToken();

        if (token) {
            // Есть токен — пробуем дёрнуть API, чтобы убедиться что он рабочий
            try {
                const response = await fetch(`${CONFIG.API.BASE_URL}/categories`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    this.isAuthenticated = true;
                    this.hideLoginScreen();
                    return true;
                }

                // Токен невалиден — стираем и показываем логин
                console.log('Токен невалиден, требуется повторный вход');
                this.clearToken();
            } catch (error) {
                console.warn('Не удалось проверить токен:', error);
                // Сервер недоступен — попробуем работать с токеном (api.js всё равно сделает retry)
                this.isAuthenticated = true;
                this.hideLoginScreen();
                return true;
            }
        }

        // Нет токена или невалиден — показываем экран входа
        this.showLoginScreen();
        await this.initGoogleSignIn();
        return false;
    }
}

export default AuthManager;
