#!/bin/bash
# Скрипт управления Budget API v2.0
# Использование: ./manage_api.sh {start|stop|restart|status|logs}

API_DIR="/opt/budget_api"
VENV_PYTHON="$API_DIR/venv/bin/python"
APP_FILE="$API_DIR/app_v2.py"
LOG_FILE="$API_DIR/app_v2.log"
PID_FILE="$API_DIR/app_v2.pid"

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Функция для получения PID процесса
get_pid() {
    if [ -f "$PID_FILE" ]; then
        cat "$PID_FILE"
    else
        ps aux | grep "[p]ython.*app_v2.py" | awk '{print $2}'
    fi
}

# Функция проверки запущен ли API
is_running() {
    local pid=$(get_pid)
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

# Запуск API
start_api() {
    if is_running; then
        echo -e "${YELLOW}⚠️  API уже запущен (PID: $(get_pid))${NC}"
        return 1
    fi

    echo -e "${GREEN}🚀 Запускаем Budget API v2.0...${NC}"

    # Проверка наличия venv
    if [ ! -f "$VENV_PYTHON" ]; then
        echo -e "${RED}❌ Виртуальное окружение не найдено: $VENV_PYTHON${NC}"
        exit 1
    fi

    # Запуск в фоне
    cd "$API_DIR"
    nohup "$VENV_PYTHON" "$APP_FILE" > "$LOG_FILE" 2>&1 &
    local pid=$!
    echo $pid > "$PID_FILE"

    # Ждём 2 секунды и проверяем статус
    sleep 2

    if is_running; then
        echo -e "${GREEN}✅ API успешно запущен (PID: $pid)${NC}"
        check_health
    else
        echo -e "${RED}❌ Ошибка запуска API. Проверьте логи:${NC}"
        tail -n 20 "$LOG_FILE"
        return 1
    fi
}

# Остановка API
stop_api() {
    if ! is_running; then
        echo -e "${YELLOW}⚠️  API не запущен${NC}"
        # Очистим PID файл на всякий случай
        rm -f "$PID_FILE"
        return 0
    fi

    local pid=$(get_pid)
    echo -e "${YELLOW}🛑 Останавливаем API (PID: $pid)...${NC}"

    kill "$pid"

    # Ждём до 10 секунд
    for i in {1..10}; do
        if ! is_running; then
            echo -e "${GREEN}✅ API остановлен${NC}"
            rm -f "$PID_FILE"
            return 0
        fi
        sleep 1
    done

    # Если процесс не остановился, убиваем принудительно
    echo -e "${RED}⚠️  Принудительная остановка...${NC}"
    kill -9 "$pid" 2>/dev/null
    rm -f "$PID_FILE"
    echo -e "${GREEN}✅ API остановлен${NC}"
}

# Перезапуск API
restart_api() {
    echo -e "${YELLOW}🔄 Перезапускаем API...${NC}"
    stop_api
    sleep 1
    start_api
}

# Статус API
status_api() {
    if is_running; then
        local pid=$(get_pid)
        echo -e "${GREEN}✅ API запущен (PID: $pid)${NC}"
        check_health

        # Информация о процессе
        echo ""
        echo "📊 Информация о процессе:"
        ps aux | grep "[p]ython.*app_v2.py" | awk '{printf "   CPU: %s%%  MEM: %s%%  Время: %s\n", $3, $4, $10}'
    else
        echo -e "${RED}❌ API не запущен${NC}"
        rm -f "$PID_FILE"
    fi
}

# Проверка health endpoint
check_health() {
    echo ""
    echo "🏥 Проверка health endpoint:"
    local response=$(curl -s http://localhost:5000/api/health)
    if [ $? -eq 0 ]; then
        echo "   $response"

        # Проверяем версию
        local version=$(echo "$response" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
        if [ "$version" = "2.0.0" ]; then
            echo -e "   ${GREEN}✅ Версия API: 2.0.0${NC}"
        else
            echo -e "   ${YELLOW}⚠️  Версия API: $version (ожидалась 2.0.0)${NC}"
        fi
    else
        echo -e "   ${RED}❌ API не отвечает${NC}"
    fi
}

# Просмотр логов
show_logs() {
    if [ ! -f "$LOG_FILE" ]; then
        echo -e "${RED}❌ Файл логов не найден: $LOG_FILE${NC}"
        return 1
    fi

    echo -e "${GREEN}📋 Последние 50 строк логов:${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    tail -n 50 "$LOG_FILE"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Для отслеживания логов в реальном времени:"
    echo "  tail -f $LOG_FILE"
}

# Главное меню
case "$1" in
    start)
        start_api
        ;;
    stop)
        stop_api
        ;;
    restart)
        restart_api
        ;;
    status)
        status_api
        ;;
    logs)
        show_logs
        ;;
    *)
        echo "Budget API v2.0 - Управление сервером"
        echo ""
        echo "Использование: $0 {start|stop|restart|status|logs}"
        echo ""
        echo "Команды:"
        echo "  start   - Запустить API"
        echo "  stop    - Остановить API"
        echo "  restart - Перезапустить API"
        echo "  status  - Статус API и проверка health"
        echo "  logs    - Показать последние логи"
        echo ""
        exit 1
        ;;
esac

exit 0
