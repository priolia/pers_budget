/**
 * Модуль аутентификации
 */

import { DataManager } from './dataManager.js';
import { CONFIG } from './config.js';

export class AuthManager {
    static isAuthenticated = false;

    /**
     * Хеширование пароля с помощью SHA-256
     */
    static async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }

    /**
     * Проверить пароль
     */
    static async verifyPassword(password) {
        const config = DataManager.getConfig();
        const storedHash = config.passwordHash;

        if (!storedHash) {
            // Пароль не установлен
            return true;
        }

        const inputHash = await this.hashPassword(password);
        return inputHash === storedHash;
    }

    /**
     * Установить новый пароль
     */
    static async setPassword(newPassword) {
        const passwordHash = await this.hashPassword(newPassword);

        DataManager.updateConfig({
            passwordHash: passwordHash
        });

        console.log('✅ Пароль установлен');

        return { success: true };
    }

    /**
     * Изменить пароль
     */
    static async changePassword(oldPassword, newPassword) {
        // Проверяем старый пароль
        const isValid = await this.verifyPassword(oldPassword);

        if (!isValid) {
            return {
                success: false,
                error: 'Неверный старый пароль'
            };
        }

        // Устанавливаем новый пароль
        await this.setPassword(newPassword);

        return { success: true };
    }

    /**
     * Удалить пароль
     */
    static removePassword() {
        DataManager.updateConfig({
            passwordHash: null
        });

        console.log('✅ Пароль удален');

        return { success: true };
    }

    /**
     * Проверить установлен ли пароль
     */
    static hasPassword() {
        const config = DataManager.getConfig();
        return !!config.passwordHash;
    }

    /**
     * Войти
     */
    static async login(password) {
        if (!this.hasPassword()) {
            // Пароль не установлен - входим без проверки
            this.isAuthenticated = true;
            return { success: true };
        }

        const isValid = await this.verifyPassword(password);

        if (isValid) {
            this.isAuthenticated = true;
            return { success: true };
        } else {
            return {
                success: false,
                error: 'Неверный пароль'
            };
        }
    }

    /**
     * Выйти
     */
    static logout() {
        this.isAuthenticated = false;
        console.log('✅ Выход выполнен');
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
     * Инициализировать обработчики логина
     */
    static initLoginHandlers() {
        const loginForm = document.getElementById('login-form');
        const passwordInput = document.getElementById('password-input');
        const loginButton = document.getElementById('login-button');
        const loginError = document.getElementById('login-error');

        if (!loginForm || !passwordInput || !loginButton) {
            console.error('Элементы формы логина не найдены');
            return;
        }

        const handleLogin = async (e) => {
            e.preventDefault();

            const password = passwordInput.value;

            if (!password) {
                if (loginError) {
                    loginError.textContent = 'Введите пароль';
                    loginError.classList.remove('hidden');
                }
                return;
            }

            loginButton.disabled = true;
            loginButton.textContent = 'Проверка...';

            const result = await this.login(password);

            if (result.success) {
                // Успешный вход
                this.hideLoginScreen();

                // Загружаем приложение
                if (window.BudgetApp && window.BudgetApp.init) {
                    await window.BudgetApp.init();
                }

            } else {
                // Ошибка входа
                if (loginError) {
                    loginError.textContent = result.error || 'Ошибка входа';
                    loginError.classList.remove('hidden');
                }

                passwordInput.value = '';
                passwordInput.focus();
            }

            loginButton.disabled = false;
            loginButton.textContent = 'Войти';
        };

        loginForm.addEventListener('submit', handleLogin);
        loginButton.addEventListener('click', handleLogin);

        // Скрыть ошибку при вводе
        passwordInput.addEventListener('input', () => {
            if (loginError) {
                loginError.classList.add('hidden');
            }
        });

        // Фокус на поле пароля при загрузке
        passwordInput.focus();
    }

    /**
     * Проверить аутентификацию при запуске
     */
    static async checkAuth() {
        if (!this.hasPassword()) {
            // Пароль не установлен - автологин
            this.isAuthenticated = true;
            this.hideLoginScreen();
            return true;
        } else {
            // Нужен пароль - показываем экран логина
            this.showLoginScreen();
            this.initLoginHandlers();
            return false;
        }
    }
}

export default AuthManager;
