class TaskCloud {
    constructor() {
        this.tasks = this.loadTasks();
        this.currentLevel = 0;
        this.currentParentId = null;
        this.navigationStack = [];
        this.longPressTimer = null;
        this.currentEditingTask = null;

        // 創建用於測量文字寬度的 canvas
        this.measureCanvas = document.createElement('canvas');
        this.measureContext = this.measureCanvas.getContext('2d');

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.renderTasks();
        this.updateBreadcrumb();
    }

    setupEventListeners() {
        // 新增任務按鈕
        document.getElementById('addTaskBtn').addEventListener('click', () => {
            this.openTaskModal();
        });

        // 模態框事件
        const modal = document.getElementById('taskEditModal');
        const closeBtn = document.querySelector('.close');
        const form = document.getElementById('taskEditForm');
        const deleteBtn = document.getElementById('deleteTaskBtn');

        closeBtn.addEventListener('click', () => this.closeTaskModal());
        
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeTaskModal();
            }
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveTask();
        });

        deleteBtn.addEventListener('click', () => {
            this.deleteTask();
        });

        // 麵包屑導航
        document.getElementById('breadcrumb').addEventListener('click', (e) => {
            if (e.target.classList.contains('breadcrumb-item')) {
                const level = parseInt(e.target.dataset.level);
                this.navigateToLevel(level);
            }
        });
    }

    loadTasks() {
        const saved = localStorage.getItem('taskCloudData');
        if (saved) {
            return JSON.parse(saved);
        }
        
        // 預設示例任務
        return {
            root: [
                {
                    id: 'task1',
                    title: '完成專案報告',
                    urgency: 4,
                    importance: 4,
                    description: '需要在本週五之前完成季度專業報告',
                    children: []
                },
                {
                    id: 'task2',
                    title: '團隊會議',
                    urgency: 3,
                    importance: 3,
                    description: '每週固定團隊同步會議',
                    children: [
                        {
                            id: 'task2-1',
                            title: '準備會議資料',
                            urgency: 4,
                            importance: 3,
                            description: '準備本週會議需要的所有資料',
                            children: []
                        },
                        {
                            id: 'task2-2',
                            title: '會議記錄',
                            urgency: 2,
                            importance: 2,
                            description: '記錄會議重點並整理成文檔',
                            children: []
                        }
                    ]
                },
                {
                    id: 'task3',
                    title: '學習新技術',
                    urgency: 2,
                    importance: 3,
                    description: '學習 React 和 Vue.js 的新功能',
                    children: []
                },
                {
                    id: 'task4',
                    title: '健身運動',
                    urgency: 3,
                    importance: 2,
                    description: '每週至少運動三次',
                    children: []
                },
                {
                    id: 'task5',
                    title: '購買生活用品',
                    urgency: 1,
                    importance: 1,
                    description: '購買日常生活所需用品',
                    children: []
                }
            ]
        };
    }

    saveTasks() {
        localStorage.setItem('taskCloudData', JSON.stringify(this.tasks));
    }

    getCurrentTasks() {
        if (this.currentLevel === 0) {
            return this.tasks.root;
        } else {
            return this.findTaskById(this.currentParentId)?.children || [];
        }
    }

    findTaskById(id) {
        const searchInArray = (arr) => {
            for (let task of arr) {
                if (task.id === id) return task;
                if (task.children && task.children.length > 0) {
                    const found = searchInArray(task.children);
                    if (found) return found;
                }
            }
            return null;
        };
        return searchInArray(this.tasks.root);
    }

    renderTasks() {
        const cloudContainer = document.getElementById('taskCloud');
        const tasks = this.getCurrentTasks();

        if (tasks.length === 0) {
            cloudContainer.innerHTML = `
                <div class="empty-state">
                    <h3>目前沒有任務</h3>
                    <p>點擊「新增任務」按鈕來創建你的第一個任務</p>
                </div>
            `;
            return;
        }

        cloudContainer.innerHTML = '';
        
        // 根據緊急程度排序（緊急的優先佔位）
        const sortedTasks = [...tasks].sort((a, b) => b.urgency - a.urgency);
        
        // 計算位置（中央向外擴散，避免重疊）
        const positions = this.calculatePositions(sortedTasks);
        
        sortedTasks.forEach((task, index) => {
            const taskElement = this.createTaskElement(task, positions[index]);
            cloudContainer.appendChild(taskElement);
        });
    }

    // 精確測量文字寬度
    measureTextWidth(text, urgency) {
        // 根據緊急程度設置字體大小
        const fontSizes = {
            4: '3rem',     // Today
            3: '2.4rem',   // in 7 days
            2: '1.8rem',   // in 21 days
            1: '1.4rem'    // 1 month
        };

        // 將 rem 轉換為 px（假設 1rem = 16px）
        const fontSizePx = parseFloat(fontSizes[urgency]) * 16;
        this.measureContext.font = `bold ${fontSizePx}px 'Microsoft JhengHei', 'Segoe UI', sans-serif`;

        const metrics = this.measureContext.measureText(text);
        return metrics.width;
    }

    // 獲取任務的實際尺寸（包含 padding）
    getTaskDimensions(task) {
        const textWidth = this.measureTextWidth(task.title, task.urgency);
        const padding = 16; // 0.5rem * 2 sides = 16px
        const margin = 30; // 額外的安全邊距

        return {
            width: textWidth + padding + margin,
            height: 80 // 固定高度（包含 padding 和邊距）
        };
    }

    calculatePositions(tasks) {
        const container = document.getElementById('taskCloud');
        const containerRect = container.getBoundingClientRect();
        const centerX = containerRect.width / 2;
        const centerY = containerRect.height / 2;

        const positions = [];
        const usedPositions = [];

        // 按照緊急程度從高到低分配位置
        const sortedTasks = [...tasks].sort((a, b) => b.urgency - a.urgency);

        sortedTasks.forEach((task, index) => {
            let position;
            let attempts = 0;
            const maxAttempts = 500; // 增加嘗試次數
            const taskDimensions = this.getTaskDimensions(task);

            do {
                if (index === 0) {
                    // 第一個（最緊急的）任務放在正中央
                    position = {
                        x: centerX,
                        y: centerY,
                        width: taskDimensions.width,
                        height: taskDimensions.height
                    };
                } else {
                    // 使用改進的螺旋算法
                    // 增加角度變化和半徑步長以更好地分散任務
                    const spiralFactor = 1.5; // 螺旋擴散因子
                    const angle = (index * 137.5 + attempts * 5) * Math.PI / 180; // 黃金角 + 微調
                    const radius = 80 + (index * 50 * spiralFactor) + (attempts * 3); // 增加基礎半徑和步長

                    position = {
                        x: centerX + radius * Math.cos(angle),
                        y: centerY + radius * Math.sin(angle),
                        width: taskDimensions.width,
                        height: taskDimensions.height
                    };

                    // 確保不超出邊界
                    const halfWidth = taskDimensions.width / 2;
                    const halfHeight = taskDimensions.height / 2;

                    position.x = Math.max(halfWidth + 10, Math.min(containerRect.width - halfWidth - 10, position.x));
                    position.y = Math.max(halfHeight + 10, Math.min(containerRect.height - halfHeight - 10, position.y));
                }

                attempts++;

                // 如果嘗試次數過多，強制放置
                if (attempts >= maxAttempts) {
                    console.warn(`任務 "${task.title}" 無法找到完全無重疊的位置，已強制放置`);
                    break;
                }
            } while (this.checkOverlap(position, usedPositions));

            positions.push(position);
            usedPositions.push({ ...position, task });
        });

        return positions;
    }

    // 使用 AABB（軸對齊邊界框）碰撞檢測
    checkOverlap(newPosition, usedPositions) {
        // 計算新位置的邊界框
        const newLeft = newPosition.x - newPosition.width / 2;
        const newRight = newPosition.x + newPosition.width / 2;
        const newTop = newPosition.y - newPosition.height / 2;
        const newBottom = newPosition.y + newPosition.height / 2;

        // 檢查是否與任何已使用的位置重疊
        return usedPositions.some(used => {
            const usedLeft = used.x - used.width / 2;
            const usedRight = used.x + used.width / 2;
            const usedTop = used.y - used.height / 2;
            const usedBottom = used.y + used.height / 2;

            // AABB 碰撞檢測：如果兩個矩形在任何軸上沒有重疊，則它們不相交
            const noOverlap = newRight < usedLeft ||   // 新矩形在已用矩形左側
                             newLeft > usedRight ||    // 新矩形在已用矩形右側
                             newBottom < usedTop ||    // 新矩形在已用矩形上方
                             newTop > usedBottom;      // 新矩形在已用矩形下方

            // 返回 true 表示有重疊
            return !noOverlap;
        });
    }

    createTaskElement(task, position) {
        const element = document.createElement('div');
        element.className = `task-item urgency-${task.urgency} importance-${task.importance}`;
        element.style.left = `${position.x}px`;
        element.style.top = `${position.y}px`;
        element.style.transform = 'translate(-50%, -50%)';
        
        element.innerHTML = `
            <div class="title">${task.title}</div>
        `;
        
        // 短點擊 - 進入子任務雲
        element.addEventListener('click', () => {
            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
                return;
            }
            this.navigateToSubtasks(task);
        });
        
        // 長點擊 - 編輯任務
        element.addEventListener('mousedown', () => {
            this.longPressTimer = setTimeout(() => {
                this.openTaskModal(task);
            }, 500); // 500ms 長按
        });
        
        element.addEventListener('mouseup', () => {
            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }
        });
        
        element.addEventListener('mouseleave', () => {
            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }
        });
        
        return element;
    }

    navigateToSubtasks(task) {
        if (!task.children || task.children.length === 0) {
            // 如果沒有子任務，可以顯示提示或讓用戶添加子任務
            this.showNotification('此任務暫無子任務，長按可以編輯或添加子任務');
            return;
        }
        
        this.navigationStack.push({
            level: this.currentLevel,
            parentId: this.currentParentId,
            title: task.title
        });
        
        this.currentLevel++;
        this.currentParentId = task.id;
        
        this.renderTasks();
        this.updateBreadcrumb();
    }

    navigateToLevel(level) {
        while (this.navigationStack.length > level) {
            this.navigationStack.pop();
        }
        
        if (level === 0) {
            this.currentLevel = 0;
            this.currentParentId = null;
        } else {
            const previousState = this.navigationStack[level - 1];
            this.currentLevel = previousState.level + 1;
            this.currentParentId = previousState.parentId;
        }
        
        this.renderTasks();
        this.updateBreadcrumb();
    }

    updateBreadcrumb() {
        const breadcrumb = document.getElementById('breadcrumb');
        let html = '<span class="breadcrumb-item" data-level="0">首頁</span>';
        
        this.navigationStack.forEach((item, index) => {
            html += `<span class="breadcrumb-item" data-level="${index + 1}">${item.title}</span>`;
        });
        
        breadcrumb.innerHTML = html;
    }

    openTaskModal(task = null) {
        const modal = document.getElementById('taskEditModal');
        const form = document.getElementById('taskEditForm');
        const deleteBtn = document.getElementById('deleteTaskBtn');
        
        this.currentEditingTask = task;
        
        if (task) {
            // 編輯現有任務
            document.getElementById('taskTitle').value = task.title;
            document.getElementById('taskUrgency').value = task.urgency;
            document.getElementById('taskImportance').value = task.importance;
            document.getElementById('taskDescription').value = task.description || '';
            deleteBtn.style.display = 'block';
        } else {
            // 新增任務
            form.reset();
            deleteBtn.style.display = 'none';
        }
        
        modal.style.display = 'block';
    }

    closeTaskModal() {
        const modal = document.getElementById('taskEditModal');
        modal.style.display = 'none';
        this.currentEditingTask = null;
    }

    saveTask() {
        const title = document.getElementById('taskTitle').value.trim();
        const urgency = parseInt(document.getElementById('taskUrgency').value);
        const importance = parseInt(document.getElementById('taskImportance').value);
        const description = document.getElementById('taskDescription').value.trim();
        
        if (!title) {
            this.showNotification('請輸入任務標題');
            return;
        }
        
        if (this.currentEditingTask) {
            // 更新現有任務
            this.currentEditingTask.title = title;
            this.currentEditingTask.urgency = urgency;
            this.currentEditingTask.importance = importance;
            this.currentEditingTask.description = description;
        } else {
            // 新增任務
            const newTask = {
                id: 'task_' + Date.now(),
                title,
                urgency,
                importance,
                description,
                children: []
            };
            
            if (this.currentLevel === 0) {
                this.tasks.root.push(newTask);
            } else {
                const parentTask = this.findTaskById(this.currentParentId);
                if (parentTask) {
                    parentTask.children.push(newTask);
                }
            }
        }
        
        this.saveTasks();
        this.renderTasks();
        this.closeTaskModal();
        this.showNotification('任務已保存');
    }

    deleteTask() {
        if (!this.currentEditingTask) return;
        
        if (confirm('確定要刪除這個任務嗎？相關的子任務也會一併刪除。')) {
            this.deleteTaskFromArray(this.tasks.root, this.currentEditingTask.id);
            this.saveTasks();
            this.renderTasks();
            this.closeTaskModal();
            this.showNotification('任務已刪除');
        }
    }

    deleteTaskFromArray(arr, taskId) {
        for (let i = 0; i < arr.length; i++) {
            if (arr[i].id === taskId) {
                arr.splice(i, 1);
                return true;
            }
            if (arr[i].children && this.deleteTaskFromArray(arr[i].children, taskId)) {
                return true;
            }
        }
        return false;
    }

    showNotification(message) {
        // 創建一個簡單的通知元素
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
}

// 添加動畫樣式
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// 初始化應用
document.addEventListener('DOMContentLoaded', () => {
    new TaskCloud();
});