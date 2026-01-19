// 全局变量
let currentPage = 'main-page';
let soundManager;
let editQuestions = [{'image': '', 'question': '', 'answer': '', 'hint': ''}];
let editIndex = 0;
let editingBank = null;
let gameBank = null;
let gameQuestions = [];
let gameAuthor = '';
let gameIndex = 0;
let correctCount = 0;
let attemptCount = 0;
let gaveUpCount = 0;
let answeredCurrent = false;

// 用于跟踪和释放blob URL，避免内存泄漏
let blobUrls = new Set();

// 添加防误触F5刷新功能
window.addEventListener('keydown', function(e) {
    // 只有在电脑版才生效（屏幕宽度大于768px）
    if (window.innerWidth > 768) {
        // 阻止F5键的默认刷新行为
        if (e.key === 'F5') {
            e.preventDefault();
            // 显示确认提示
            if (confirm('确定要刷新页面吗？当前游戏进度将会丢失。')) {
                // 用户确认后才刷新页面
                window.location.reload();
            }
        }
    }
});

// 添加首页标题彩蛋功能
let titleClickCount = 0;
let titleClickTimeout = null;

// 页面加载完成后添加事件监听
document.addEventListener('DOMContentLoaded', function() {
    const titleElement = document.querySelector('#main-page .content h1.outlined-text');
    if (titleElement) {
        titleElement.addEventListener('click', function(e) {
            // 增加点击计数
            titleClickCount++;
            
            // 清除之前的超时计时器
            if (titleClickTimeout) {
                clearTimeout(titleClickTimeout);
            }
            
            // 设置新的超时计时器，如果3秒内没有再次点击，则重置计数
            titleClickTimeout = setTimeout(function() {
                titleClickCount = 0;
            }, 3000);
            
            // 连续点击3次，触发彩蛋
            if (titleClickCount === 3) {
                showEasterEggModal();
                // 重置计数，以便可以重复触发
                titleClickCount = 0;
            }
        });
    }
});

// 公共函数：处理图片URL
function getImageSrc(imgData) {
    if (!imgData) return '';
    
    // 检查是否是URL（以http://或https://开头）
    if (imgData.startsWith('http://') || imgData.startsWith('https://')) {
        // 是完整URL，直接使用
        return imgData;
    } else if (imgData.includes('\\') || imgData.includes('/')) {
        // 是相对路径，直接使用
        return imgData.replace(/\\/g, '/');
    }
    
    return imgData;
}

// 释放blob URL的函数
function releaseBlobUrl(url) {
    if (url && url.startsWith('blob:') && blobUrls.has(url)) {
        URL.revokeObjectURL(url);
        blobUrls.delete(url);
    }
}

// 释放所有blob URL
function releaseAllBlobUrls() {
    blobUrls.forEach(url => {
        URL.revokeObjectURL(url);
    });
    blobUrls.clear();
}

// 页面切换函数
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
    currentPage = pageId;
    
    // 记录页面历史，但避免重复记录相同页面
    if (pageHistory.length === 0 || pageHistory[pageHistory.length - 1] !== pageId) {
        pageHistory.push(pageId);
        // 使用history.pushState更新浏览器历史记录
        // 这样可以确保浏览器的历史记录与我们的pageHistory数组同步
        history.pushState({ page: pageId }, '', '');
    }
}

function showMainPage() {
    showPage('main-page');
}

function showSettingsPage() {
    // 确保所有滑块值与当前音量同步
    const currentBgmVolume = soundManager.bgmVolume;
    const currentSfxVolume = soundManager.sfxVolume;
    
    // 更新所有bgm音量滑块
    document.querySelectorAll('[id^="bgm-volume"]').forEach(slider => {
        slider.value = currentBgmVolume;
    });
    
    // 更新所有音效音量滑块
    document.querySelectorAll('[id^="sfx-volume"]').forEach(slider => {
        slider.value = currentSfxVolume;
    });
    
    // 更新所有BGM选择下拉框
    soundManager.updateBgmSelect();
    
    // 确保BGM开关图标显示正确
    soundManager.updateBgmButton();
    
    // 确保鬼畜模式开关图标显示正确
    soundManager.updateGhostModeButton();
    
    // 显示设置弹窗而不是页面
    document.getElementById('settings-modal').style.display = 'flex';
}

function closeSettingsModal() {
    document.getElementById('settings-modal').style.display = 'none';
}



function showSelectBankPage() {
    showPage('select-bank-page');
    refreshSelectBankList();
}

function showAddBankPage() {
    showPage('edit-bank-page');
    editQuestions = [{'image': '', 'question': '', 'answer': '', 'hint': ''}];
    editIndex = 0;
    editingBank = null;
    document.getElementById('edit-bank-name').value = '新题库';
    document.getElementById('edit-author').value = '';
    loadEditorQuestion();
}

// 音效管理器
class SoundManager {
    constructor() {
        // 从localStorage加载设置，如果没有则使用默认值
        this.loadSettings();
        
        this.sounds = {};
        this.bgm = null;
        this.loadSounds();
        this.setupEventListeners();
        this.setupButtonClickSounds();
        this.updateBgmButton();
        this.updateGhostModeButton();
        
        // 初始化所有音量滑块的值
        this.updateAllVolumeSliders();
    }
    
    // 从localStorage加载设置
    loadSettings() {
        const savedSettings = localStorage.getItem('eoe-guess-settings');
        if (savedSettings) {
            try {
                const settings = JSON.parse(savedSettings);
                this.bgmVolume = settings.bgmVolume || 0.5;
                this.sfxVolume = settings.sfxVolume || 0.5;
                this.currentBgm = settings.currentBgm || 'bgm.mp3';
                this.ghostMode = settings.ghostMode || false;
                // 背景音乐开关状态不保存，默认关闭
                this.bgmPlaying = false;
            } catch (e) {
                console.error('加载设置失败:', e);
                // 使用默认值
                this.useDefaultSettings();
            }
        } else {
            // 使用默认值
            this.useDefaultSettings();
        }
    }
    
    // 使用默认设置
    useDefaultSettings() {
        this.bgmVolume = 0.5;
        this.sfxVolume = 0.5;
        this.bgmPlaying = false;
        this.currentBgm = 'bgm.mp3';
        this.ghostMode = true;
    }
    
    // 将设置保存到localStorage
    saveSettings() {
        const settings = {
            bgmVolume: this.bgmVolume,
            sfxVolume: this.sfxVolume,
            currentBgm: this.currentBgm,
            ghostMode: this.ghostMode
        };
        localStorage.setItem('eoe-guess-settings', JSON.stringify(settings));
    }
    
    // 切换真的假的模式
    toggleGhostMode() {
        this.ghostMode = !this.ghostMode;
        this.saveSettings();
        this.updateGhostModeButton();
        return this.ghostMode;
    }
    
    // 更新真的假的模式按钮状态
    updateGhostModeButton() {
        const btnElements = document.querySelectorAll('[id^="ghost-mode-toggle"]');
        btnElements.forEach(btn => {
            if (btn) {
                btn.innerHTML = this.ghostMode ? '✅' : '❌';
                btn.className = 'bgm-toggle-btn-small';
            }
        });
    }
    
    // 设置真的假的模式状态
    setGhostMode(enabled) {
        this.ghostMode = enabled;
        this.saveSettings();
        this.updateGhostModeButton();
    }
    
    // 更新所有音量滑块的值
    updateAllVolumeSliders() {
        // 更新所有bgm音量滑块
        document.querySelectorAll('[id^="bgm-volume"]').forEach(slider => {
            slider.value = this.bgmVolume;
        });
        
        // 更新所有音效音量滑块
        document.querySelectorAll('[id^="sfx-volume"]').forEach(slider => {
            slider.value = this.sfxVolume;
        });
    }
    
    updateBgmButton() {
        // 更新所有背景音乐开关按钮（包括页面和弹窗）
        const btnElements = document.querySelectorAll('[id^="bgm-toggle-btn"]');
        btnElements.forEach(btn => {
            if (btn) {
                btn.innerHTML = this.bgmPlaying ? '🔊' : '🔇';
            }
        });
    }

    loadSounds() {
        // 音效文件路径
        const soundFiles = {
            'win': 'sounds/win.wav',
            'lose': 'sounds/lose.wav',
            'clear': 'sounds/clear.wav',
            'click': 'sounds/click.wav'
        };

        // 加载音效
        for (const [name, filename] of Object.entries(soundFiles)) {
            const audio = new Audio(filename);
            audio.volume = this.sfxVolume;
            this.sounds[name] = audio;
        }

        // 加载背景音乐
        let bgmUrl;
        if (this.currentBgm === 'bgm2.mp3') {
            // 使用外部URL
            bgmUrl = 'https://eoeguessgamer-1395525938.cos.ap-shanghai.myqcloud.com/sounds/%E9%9C%B2%E6%97%A9%E5%85%A5%E9%98%B5%E6%9B%B2.mp3';
        } else if (this.currentBgm === 'together.mp4') {
            // 使用外部URL
            bgmUrl = 'https://eoeguessgamer-1395525938.cos.ap-shanghai.myqcloud.com/sounds/%E5%92%8C%E4%BD%A0%E5%9C%A8%E4%B8%80%E8%B5%B7.mp4';
        } else if (this.currentBgm === 'guang.mp4') {
            // 使用外部URL
            bgmUrl = 'https://eoeguessgamer-1395525938.cos.ap-shanghai.myqcloud.com/sounds/%E8%A7%85%E5%85%89.mp4';
        } else {
            // 使用本地文件
            bgmUrl = `sounds/${this.currentBgm}`;
        }
        this.bgm = new Audio(bgmUrl);
        this.bgm.volume = this.bgmVolume;
        this.bgm.loop = true;
    }

    playBgm() {
        if (this.bgm) {
            this.bgm.play().catch(e => {
                console.log('背景音乐播放失败:', e);
            });
            this.bgmPlaying = true;
            this.updateBgmButton();
        }
    }

    pauseBgm() {
        if (this.bgm) {
            this.bgm.pause();
            this.bgmPlaying = false;
            this.updateBgmButton();
        }
    }

    toggleBgm() {
        if (this.bgmPlaying) {
            this.pauseBgm();
        } else {
            this.playBgm();
        }
        return this.bgmPlaying;
    }

    setBgmVolume(volume) {
        this.bgmVolume = volume;
        if (this.bgm) {
            this.bgm.volume = volume;
        }
        this.saveSettings(); // 保存设置
    }

    // 切换背景音乐
    changeBgm(bgmName) {
        if (this.currentBgm === bgmName) {
            return; // 已经是当前BGM，不需要切换
        }
        
        const wasPlaying = this.bgmPlaying;
        
        // 暂停当前BGM
        if (this.bgm) {
            this.bgm.pause();
            this.bgm.currentTime = 0;
        }
        
        // 更新当前BGM名称
        this.currentBgm = bgmName;
        
        // 重新加载BGM
        let bgmUrl;
        if (bgmName === 'bgm2.mp3') {
            // 使用外部URL
            bgmUrl = 'https://eoeguessgamer-1395525938.cos.ap-shanghai.myqcloud.com/sounds/%E9%9C%B2%E6%97%A9%E5%85%A5%E9%98%B5%E6%9B%B2.mp3';
        } else if (bgmName === 'together.mp4') {
            // 使用外部URL
            bgmUrl = 'https://eoeguessgamer-1395525938.cos.ap-shanghai.myqcloud.com/sounds/%E5%92%8C%E4%BD%A0%E5%9C%A8%E4%B8%80%E8%B5%B7.mp4';
        } else if (bgmName === 'guang.mp4') {
            // 使用外部URL
            bgmUrl = 'https://eoeguessgamer-1395525938.cos.ap-shanghai.myqcloud.com/sounds/%E8%A7%85%E5%85%89.mp4';
        } else {
            // 使用本地文件
            bgmUrl = `sounds/${this.currentBgm}`;
        }
        this.bgm = new Audio(bgmUrl);
        this.bgm.volume = this.bgmVolume;
        this.bgm.loop = true;
        
        // 如果之前是播放状态，继续播放
        if (wasPlaying) {
            this.playBgm();
        }
        
        // 同步所有BGM选择下拉框
        this.updateBgmSelect();
        this.saveSettings(); // 保存设置
    }
    
    // 更新所有BGM选择下拉框
    updateBgmSelect() {
        document.querySelectorAll('[id^="bgm-select"]').forEach(select => {
            select.value = this.currentBgm;
        });
    }

    setSfxVolume(volume) {
        this.sfxVolume = volume;
        for (const audio of Object.values(this.sounds)) {
            audio.volume = volume;
        }
        this.saveSettings(); // 保存设置
    }

    playSound(name) {
        if (this.sounds[name]) {
            const audio = this.sounds[name].cloneNode();
            audio.volume = this.sfxVolume;
            audio.play().catch(e => {
                console.log(`音效 ${name} 播放失败:`, e);
            });
        }
    }

    setupEventListeners() {
        // 音量控制 - 直接绑定事件，确保this指向正确
        const self = this;
        
        // 为所有bgm音量滑块添加事件监听（包括页面和弹窗）
        const bgmVolumeSliders = document.querySelectorAll('[id^="bgm-volume"]');
        bgmVolumeSliders.forEach(slider => {
            // 先移除现有的事件监听器，防止重复绑定
            slider.removeEventListener('input', bgmVolumeHandler);
            function bgmVolumeHandler(e) {
                const volume = parseFloat(e.target.value);
                self.setBgmVolume(volume);
                // 同步所有bgm音量滑块的值
                document.querySelectorAll('[id^="bgm-volume"]').forEach(s => {
                    s.value = volume;
                });
            }
            slider.addEventListener('input', bgmVolumeHandler);
        });
        
        // 为所有音效音量滑块添加事件监听（包括页面和弹窗）
        const sfxVolumeSliders = document.querySelectorAll('[id^="sfx-volume"]');
        sfxVolumeSliders.forEach(slider => {
            // 先移除现有的事件监听器，防止重复绑定
            slider.removeEventListener('input', sfxVolumeHandler);
            function sfxVolumeHandler(e) {
                const volume = parseFloat(e.target.value);
                self.setSfxVolume(volume);
                // 同步所有音效音量滑块的值
                document.querySelectorAll('[id^="sfx-volume"]').forEach(s => {
                    s.value = volume;
                });
            }
            slider.addEventListener('input', sfxVolumeHandler);
        });
        
        // 为所有BGM选择下拉框添加事件监听（包括页面和弹窗）
        const bgmSelects = document.querySelectorAll('[id^="bgm-select"]');
        bgmSelects.forEach(select => {
            // 先移除现有的事件监听器，防止重复绑定
            select.removeEventListener('change', bgmSelectHandler);
            function bgmSelectHandler(e) {
                const bgmName = e.target.value;
                self.changeBgm(bgmName);
            }
            select.addEventListener('change', bgmSelectHandler);
        });
        
        // 为所有鬼畜模式开关按钮添加事件监听（包括页面和弹窗）
        const ghostModeButtons = document.querySelectorAll('[id^="ghost-mode-toggle"]');
        ghostModeButtons.forEach(btn => {
            // 先移除现有的事件监听器，防止重复绑定
            btn.removeEventListener('click', ghostModeHandler);
            function ghostModeHandler() {
                self.toggleGhostMode();
            }
            btn.addEventListener('click', ghostModeHandler);
        });
    }

    setupButtonClickSounds() {
        // 为所有圆角按钮添加点击音效，但排除确认按钮（回答按钮）和下一题按钮
        const buttons = document.querySelectorAll('.rounded-button');
        buttons.forEach(button => {
            // 检查按钮是否为确认按钮（回答按钮）或下一题按钮
            const isCheckAnswerButton = button.onclick && button.onclick.toString().includes('checkAnswer');
            const isNextButton = button.onclick && button.onclick.toString().includes('nextQuestion');
            if (!isCheckAnswerButton && !isNextButton) {
                button.addEventListener('click', () => {
                    this.playSound('click');
                });
            }
        });
    }
}

// 已玩过题库管理
function getPlayedBanks() {
    const playedBanks = localStorage.getItem('eoe-guess-played-banks');
    return playedBanks ? JSON.parse(playedBanks) : [];
}

function isBankPlayed(bankId) {
    const playedBanks = getPlayedBanks();
    return playedBanks.includes(bankId);
}

function markBankAsPlayed(bankId) {
    const playedBanks = getPlayedBanks();
    if (!playedBanks.includes(bankId)) {
        playedBanks.push(bankId);
        localStorage.setItem('eoe-guess-played-banks', JSON.stringify(playedBanks));
    }
}


// 题库管理类
class QuestionBank {
    static getBanks() {
        const banks = localStorage.getItem('eoe-guess-banks');
        return banks ? JSON.parse(banks) : [];
    }

    static saveBanks(banks) {
        localStorage.setItem('eoe-guess-banks', JSON.stringify(banks));
    }

    static getAllBanks() {
        return this.getBanks();
    }

    static saveBank(name, author, questions) {
        const banks = this.getBanks();
        const bank = {
            id: Date.now(),
            name: name,
            author: author,
            questions: questions,
            count: questions.length
        };
        banks.push(bank);
        this.saveBanks(banks);
        return bank;
    }

    static updateBank(bankId, name, author, questions) {
        const banks = this.getBanks();
        const index = banks.findIndex(b => b.id === bankId);
        if (index !== -1) {
            banks[index] = {
                ...banks[index],
                name: name,
                author: author,
                questions: questions,
                count: questions.length
            };
            this.saveBanks(banks);
            return true;
        }
        return false;
    }

    static deleteBank(bankId) {
        const banks = this.getBanks();
        const newBanks = banks.filter(b => b.id !== bankId);
        this.saveBanks(newBanks);
    }

    static loadBank(bankId) {
        const banks = this.getBanks();
        return banks.find(b => b.id === bankId);
    }

    static importBank(jsonData) {
        try {
            const bankData = JSON.parse(jsonData);
            if (!bankData.name || !bankData.questions) {
                return { success: false, message: '无效的题库格式' };
            }
            
            const banks = this.getBanks();
            
            // 检查是否已存在同名题库，如果存在则替换
            const existingIndex = banks.findIndex(b => b.name === bankData.name);
            
            const bank = {
                // 优先使用JSON文件中指定的id，否则保留原有ID，再否则生成新ID
                id: bankData.id || (existingIndex !== -1 ? banks[existingIndex].id : Date.now()),
                name: bankData.name,
                author: bankData.author || '未知',
                questions: bankData.questions,
                count: bankData.questions.length
            };
            
            if (existingIndex !== -1) {
                // 替换旧题库
                banks[existingIndex] = bank;
            } else {
                // 添加新题库
                banks.push(bank);
            }
            
            this.saveBanks(banks);
            return { success: true, message: '导入成功' };
        } catch (e) {
            return { success: false, message: `导入失败: ${e.message}` };
        }
    }
}

// 刷新题库列表


// 刷新选择题库列表
function refreshSelectBankList() {
    const bankList = document.getElementById('select-bank-list');
    bankList.innerHTML = '';
    
    let banks = QuestionBank.getAllBanks();
    
    if (banks.length === 0) {
        bankList.innerHTML = '<div class="outlined-text" style="margin: 50px;text-align: center;">暂无题库，请先添加</div>';
        return;
    }
    
    // 排序：让第一期重制版显示在最前面
    banks = banks.sort((a, b) => {
        // 优先显示第一期重制版
        if (a.name === '第一期重制版') return -1;
        if (b.name === '第一期重制版') return 1;
        // 其他题库按默认顺序显示
        return 0;
    });
    
    banks.forEach(bank => {
        const bankItem = createBankItem(bank, false);
        bankList.appendChild(bankItem);
    });
}

// 创建题库项
function createBankItem(bank, isManagePage) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'bank-item';
    
    const infoDiv = document.createElement('div');
    infoDiv.className = 'bank-item-info';
    
    // 检查题库是否已玩过
    const isPlayed = isBankPlayed(bank.id);
    // 创建已玩过标记
    const playedMark = isPlayed ? '<span style="color: #4CAF50; margin-left: 8px; font-weight: bold;">✓ 已玩过</span>' : '';
    
    infoDiv.innerHTML = `<div class="outlined-text">${bank.name}${playedMark}    作者：${bank.author}    题目：${bank.count}道</div>`;
    
    const btnDiv = document.createElement('div');
    btnDiv.className = 'bank-item-buttons';
    
    if (isManagePage) {
        // 管理页面的按钮
        const editBtn = document.createElement('button');
        editBtn.className = 'rounded-button';
        editBtn.textContent = '编辑';
        editBtn.onclick = () => showEditBankPage(bank);
        
        const exportBtn = document.createElement('button');
        exportBtn.className = 'rounded-button';
        exportBtn.textContent = '导出';
        exportBtn.onclick = () => exportBank(bank);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'rounded-button error';
        deleteBtn.textContent = '删除';
        deleteBtn.onclick = () => deleteBank(bank);
        
        btnDiv.appendChild(editBtn);
        btnDiv.appendChild(exportBtn);
        btnDiv.appendChild(deleteBtn);
    } else {
        // 选择页面的按钮
        const selectBtn = document.createElement('button');
        selectBtn.className = 'rounded-button success';
        selectBtn.textContent = '开始';
        selectBtn.onclick = () => startGame(bank);
        
        // 添加导出按钮
        const exportBtn = document.createElement('button');
        exportBtn.className = 'rounded-button';
        exportBtn.textContent = '导出';
        exportBtn.onclick = () => exportBank(bank);
        
        btnDiv.appendChild(selectBtn);
        btnDiv.appendChild(exportBtn);
    }
    
    itemDiv.appendChild(infoDiv);
    itemDiv.appendChild(btnDiv);
    
    return itemDiv;
}

// 编辑题库
function showEditBankPage(bank) {
    showPage('edit-bank-page');
    editingBank = bank;
    editQuestions = JSON.parse(JSON.stringify(bank.questions));
    if (!editQuestions.length) {
        editQuestions = [{'image': '', 'question': '', 'answer': '', 'hint': ''}];
    }
    editIndex = 0;
    document.getElementById('edit-bank-name').value = bank.name;
    document.getElementById('edit-author').value = bank.author;
    loadEditorQuestion();
}

// 加载编辑题
function loadEditorQuestion() {
    if (editIndex >= 0 && editIndex < editQuestions.length) {
        const q = editQuestions[editIndex];
        
        document.getElementById('edit-question').value = q.question || '';
        document.getElementById('edit-answer').value = q.answer || '';
        document.getElementById('edit-hint').value = q.hint || '';
        
        const imgData = q.image;
        const imgButton = document.getElementById('img-button');
        const previewImg = document.getElementById('preview-image');
        
        if (imgData) {
            // 使用公共函数处理图片URL
            const imageSrc = getImageSrc(imgData);
            
            // 清除之前的事件监听器
            previewImg.onload = null;
            previewImg.onerror = null;
            
            // 添加图片加载事件处理
            previewImg.onload = () => {
                previewImg.style.display = 'block';
                imgButton.querySelector('span').style.display = 'none';
            };
            
            previewImg.onerror = () => {
                console.error('预览图片加载失败:', imageSrc);
                previewImg.style.display = 'none';
                imgButton.querySelector('span').style.display = 'block';
                // 移除错误提示，避免干扰用户体验
            };
            
            // 设置图片源
            previewImg.src = imageSrc;
        } else {
            previewImg.src = '';
            previewImg.style.display = 'none';
            imgButton.querySelector('span').style.display = 'block';
        }
    }
    
    const total = editQuestions.length;
    const valid = editQuestions.filter(q => q.answer).length;
    document.getElementById('question-info').textContent = `第 ${editIndex + 1} / ${total} 题 (有效: ${valid})`;
}



// 图片压缩和格式转换函数
async function compressImage(file, options = {}) {
    const {
        maxWidth = 1920,
        maxHeight = 1080,
        quality = 0.95,
        format = 'webp'
    } = options;

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                // 计算缩放比例
                let width = img.width;
                let height = img.height;
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width *= ratio;
                    height *= ratio;
                }

                // 创建canvas并绘制图片
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // 转换为指定格式
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve({
                                blob: blob,
                                url: URL.createObjectURL(blob),
                                width: width,
                                height: height
                            });
                        } else {
                            reject(new Error('图片压缩失败'));
                        }
                    },
                    `image/${format}`,
                    quality
                );
            };
            img.onerror = () => {
                reject(new Error('图片加载失败'));
            };
        };
        reader.onerror = () => {
            reject(new Error('文件读取失败'));
        };
    });
}

// 编辑器上传图片
function editorUploadImage() {
    document.getElementById('file-input').click();
}

// 图片选择事件
document.getElementById('file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        try {
            // 检查文件大小（限制为5MB）
            const maxSize = 5 * 1024 * 1024; // 5MB
            if (file.size > maxSize) {
                alert('图片大小不能超过5MB，请选择更小的图片');
                return;
            }

            // 图片压缩和格式转换
            const compressedImage = await compressImage(file, {
                maxWidth: 1920,
                maxHeight: 1080,
                quality: 0.95,
                format: 'webp'
            });
            
            // 显示预览
            const previewImg = document.getElementById('preview-image');
            const imgButton = document.getElementById('img-button');
            
            previewImg.onload = () => {
                previewImg.style.display = 'block';
                imgButton.querySelector('span').style.display = 'none';
            };
            
            previewImg.onerror = () => {
                console.error('预览图片加载失败');
                previewImg.style.display = 'none';
                imgButton.querySelector('span').style.display = 'block';
            };
            
            previewImg.src = compressedImage.url;
            
            // 保存压缩后的图片数据
            // 先释放之前可能存在的blob URL
            if (editQuestions[editIndex].image && editQuestions[editIndex].image.startsWith('blob:')) {
                releaseBlobUrl(editQuestions[editIndex].image);
            }
            editQuestions[editIndex].image = compressedImage.url;
            editQuestions[editIndex].imageWidth = compressedImage.width;
            editQuestions[editIndex].imageHeight = compressedImage.height;
            // 将新生成的blob URL添加到跟踪列表
            blobUrls.add(compressedImage.url);
        } catch (error) {
            console.error('图片处理失败:', error);
            alert('图片上传失败');
        }
    }
});

// 编辑按钮事件
function editorPrev() {
    if (editIndex > 0) {
        saveEditorQuestion();
        editIndex--;
        loadEditorQuestion();
    }
}

function editorNext() {
    saveEditorQuestion();
    if (editIndex < editQuestions.length - 1) {
        editIndex++;
        loadEditorQuestion();
    } else {
        // 没有下一题时自动添加新题
        editQuestions.push({'image': '', 'question': '', 'answer': '', 'hint': ''});
        editIndex = editQuestions.length - 1;
        loadEditorQuestion();
    }
}

function editorAdd() {
    saveEditorQuestion();
    editQuestions.push({'image': '', 'question': '', 'answer': '', 'hint': ''});
    editIndex = editQuestions.length - 1;
    loadEditorQuestion();
}

function editorClear() {
    // 释放当前题目的blob URL
    if (editQuestions[editIndex].image && editQuestions[editIndex].image.startsWith('blob:')) {
        releaseBlobUrl(editQuestions[editIndex].image);
    }
    
    // 删除当前题目
    editQuestions.splice(editIndex, 1);
    
    // 如果删除后还有题目，回到上一题或保持在最后一题
    if (editQuestions.length > 0) {
        // 如果删除的是最后一题，保持在当前位置（即新的最后一题）
        // 否则回到上一题
        editIndex = Math.min(editIndex, editQuestions.length - 1);
        loadEditorQuestion();
    } else {
        // 如果删除后没有题目了，添加一道新题
        editQuestions.push({'image': '', 'question': '', 'answer': '', 'hint': ''});
        editIndex = 0;
        loadEditorQuestion();
    }
}

// 将blob URL转换为base64格式的函数
function blobToBase64(blobUrl) {
    return new Promise((resolve, reject) => {
        fetch(blobUrl)
            .then(response => response.blob())
            .then(blob => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    resolve(reader.result);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            })
            .catch(reject);
    });
}

// 保存编辑的题目
function saveEditorQuestion() {
    if (editQuestions && editQuestions.length > 0 && editIndex >= 0 && editIndex < editQuestions.length) {
        editQuestions[editIndex] = {
            image: editQuestions[editIndex].image || '',
            question: document.getElementById('edit-question').value.trim(),
            answer: document.getElementById('edit-answer').value.trim(),
            hint: document.getElementById('edit-hint').value.trim()
        };
    }
}

function editorSave() {
    saveEditorQuestion();
    const validQuestions = editQuestions.filter(q => q.answer);
    
    if (validQuestions.length === 0) {
        alert('请至少添加一道有效题目（必须有答案）！');
        return;
    }
    
    const bankName = document.getElementById('edit-bank-name').value.trim() || '新题库';
    const author = document.getElementById('edit-author').value.trim() || '未知';
    
    // 处理图片数据：将blob URL转换为base64格式以便持久化存储
    const processedQuestions = validQuestions.map(async (q) => {
        const processedQ = { ...q };
        if (q.image && q.image.startsWith('blob:')) {
            try {
                processedQ.image = await blobToBase64(q.image);
            } catch (e) {
                console.error('转换blob URL为base64失败:', e);
                // 转换失败时保留原始blob URL
            }
        }
        return processedQ;
    });
    
    // 等待所有图片转换完成
    Promise.all(processedQuestions)
        .then((processedQuestionsArray) => {
            if (editingBank) {
                QuestionBank.updateBank(editingBank.id, bankName, author, processedQuestionsArray);
            } else {
                QuestionBank.saveBank(bankName, author, processedQuestionsArray);
            }
            
            alert('保存成功！');
        })
        .catch(err => {
            console.error('处理图片数据失败:', err);
            alert('保存失败！请重试。');
        });
}

// 导出题库（支持编辑页面和管理页面调用）
function exportBank(bank) {
    let bankData, questions, bankName;
    
    if (bank) {
        // 管理页面或选择页面调用：使用传入的bank对象
        bankName = bank.name;
        questions = bank.questions;
        bankData = {
            id: bank.id,
            name: bank.name,
            author: bank.author,
            questions: bank.questions,
            count: bank.questions.length,
            createdAt: bank.createdAt
        };
    } else {
        // 编辑页面调用：使用当前编辑的题库数据
        saveEditorQuestion();
        const validQuestions = editQuestions.filter(q => q.answer);
        
        if (validQuestions.length === 0) {
            alert('请至少添加一道有效题目（必须有答案）！');
            return;
        }
        
        bankName = document.getElementById('edit-bank-name').value.trim() || '新题库';
        const author = document.getElementById('edit-author').value.trim() || '未知';
        
        questions = validQuestions;
        bankData = {
            id: editingBank ? editingBank.id : Date.now(),
            name: bankName,
            author: author,
            questions: validQuestions,
            count: validQuestions.length,
            createdAt: editingBank ? editingBank.createdAt : new Date().toISOString()
        };
    }
    
    // 创建压缩文件
    const zip = new JSZip();
    const imagesFolder = zip.folder('images');
    
    // 复制题目数据，用于修改图片路径
    const exportQuestions = JSON.parse(JSON.stringify(questions));
    
    // 下载并添加图片到压缩包的Promise数组
    const imagePromises = [];
    
    exportQuestions.forEach((q, index) => {
        if (q.image) {
            if (q.image.startsWith('blob:')) {
                // 处理blob URL图片
                // 注意：从localStorage加载的blob URL可能已失效
                const promise = new Promise((resolve) => {
                    fetch(q.image)
                        .then(response => response.blob())
                        .then(blob => {
                            // 生成唯一的图片文件名
                            const imageName = `question_${index + 1}_${Date.now()}.webp`;
                            // 将图片添加到压缩包
                            imagesFolder.file(imageName, blob);
                            // 更新题目中的图片路径
                            q.image = `images/${imageName}`;
                            resolve();
                        })
                        .catch(() => {
                            // 处理失败时，尝试检查是否有base64数据或其他格式
                            console.warn('Blob URL图片处理失败，保留原始路径:', q.image);
                            // 保留原始路径
                            resolve();
                        });
                });
                imagePromises.push(promise);
            } else if (q.image.startsWith('http://') || q.image.startsWith('https://')) {
                // 处理外部URL图片
                const promise = new Promise((resolve) => {
                    fetch(q.image)
                        .then(response => response.blob())
                        .then(blob => {
                            // 生成唯一的图片文件名
                            const extension = q.image.split('.').pop().split('?')[0] || 'jpg';
                            const imageName = `question_${index + 1}_${Date.now()}.${extension}`;
                            // 将图片添加到压缩包
                            imagesFolder.file(imageName, blob);
                            // 更新题目中的图片路径
                            q.image = `images/${imageName}`;
                            resolve();
                        })
                        .catch(() => {
                            // 处理失败时保留原始路径
                            console.warn('外部URL图片处理失败，保留原始路径:', q.image);
                            resolve();
                        });
                });
                imagePromises.push(promise);
            } else if (q.image.includes(',')) {
                // 处理base64格式图片
                try {
                    const base64Data = q.image.split(',')[1];
                    const blob = new Blob([Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))], {
                        type: 'image/webp'
                    });
                    const imageName = `question_${index + 1}_${Date.now()}.webp`;
                    imagesFolder.file(imageName, blob);
                    q.image = `images/${imageName}`;
                } catch (e) {
                    console.warn('Base64图片处理失败，保留原始路径:', e);
                }
            } else {
                // 处理相对路径图片
                const promise = new Promise((resolve) => {
                    fetch(q.image)
                        .then(response => response.blob())
                        .then(blob => {
                            // 生成唯一的图片文件名，保留原始扩展名
                            const extension = q.image.split('.').pop() || 'jpg';
                            const imageName = `question_${index + 1}_${Date.now()}.${extension}`;
                            // 将图片添加到压缩包
                            imagesFolder.file(imageName, blob);
                            // 更新题目中的图片路径
                            q.image = `images/${imageName}`;
                            resolve();
                        })
                        .catch(() => {
                            // 处理失败时保留原始路径
                            console.warn('相对路径图片处理失败，保留原始路径:', q.image);
                            resolve();
                        });
                });
                imagePromises.push(promise);
            }
        }
    });
    
    // 等待所有图片处理完成
    Promise.all(imagePromises)
        .then(() => {
            // 更新bankData中的题目为处理后的题目
            bankData.questions = exportQuestions;
            bankData.count = exportQuestions.length;
            
            // 添加JSON文件到压缩包
            const jsonString = JSON.stringify(bankData, null, 2);
            zip.file('bank.json', jsonString);
            
            // 生成压缩包并下载
            zip.generateAsync({ type: 'blob' })
                .then(content => {
                    const url = URL.createObjectURL(content);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${bankName}_${new Date().getTime()}.zip`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    
                    showExportSuccessModal();
                })
                .catch(err => {
                    console.error('生成压缩包失败:', err);
                    alert('导出失败！请重试。');
                });
        })
        .catch(err => {
            console.error('处理图片失败:', err);
            alert('导出失败！请重试。');
        });
}

// 导入题库
function importBank() {
    document.getElementById('bank-import-input').click();
}

// 题库导入事件
document.getElementById('bank-import-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const result = QuestionBank.importBank(event.target.result);
            if (result.success) {
                alert('导入成功！');
                refreshSelectBankList();
            } else {
                alert(result.message);
            }
        };
        reader.readAsText(file);
    }
});



// 删除题库
function deleteBank(bank) {
    if (confirm(`确定删除题库 '${bank.name}' 吗？`)) {
        QuestionBank.deleteBank(bank.id);
        refreshSelectBankList();
    }
}

// 图片预加载核心函数
async function preloadImages(questions) {
    return new Promise((resolve) => {
        // 显示加载进度条
        const loadingOverlay = document.getElementById('loading-overlay');
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        loadingOverlay.style.display = 'flex';
        
        // 获取所有需要加载的图片URL
        const imagesToLoad = [];
        questions.forEach(question => {
            if (question.image) {
                const imageSrc = getImageSrc(question.image);
                if (imageSrc) {
                    imagesToLoad.push(imageSrc);
                }
            }
        });
        
        const totalImages = imagesToLoad.length;
        if (totalImages === 0) {
            // 没有图片需要加载，直接完成
            loadingOverlay.style.display = 'none';
            resolve();
            return;
        }
        
        let loadedImages = 0;
        
        // 更新进度的函数
        const updateProgress = () => {
            const progress = Math.floor((loadedImages / totalImages) * 100);
            progressBar.style.width = `${progress}%`;
            progressText.textContent = `${progress}%`;
        };
        
        // 使用懒加载管理器预加载图片
        const loadAllImages = async () => {
            for (const imageSrc of imagesToLoad) {
                try {
                    await imageLoader.loadImageWithRetry(imageSrc);
                } catch (error) {
                    console.warn('图片预加载失败:', error);
                } finally {
                    loadedImages++;
                    updateProgress();
                }
            }
            
            // 加载完成后延迟1秒隐藏加载框，让用户有足够时间感知到加载完成
            setTimeout(() => {
                loadingOverlay.style.display = 'none';
                resolve();
            }, 1000);
        };
        
        loadAllImages();
    });
}

// 开始游戏
async function startGame(bank) {
    gameBank = bank;
    gameQuestions = JSON.parse(JSON.stringify(bank.questions));
    gameAuthor = bank.author || '未知';
    gameIndex = 0;
    correctCount = 0;
    attemptCount = 0;
    gaveUpCount = 0;
    answeredCurrent = false;
    
    // 如果BGM是关闭的，自动开启
    if (!soundManager.bgmPlaying) {
        soundManager.playBgm();
    }
    
    // 预加载前5张图片
    const imagesToPreload = [];
    const preloadCount = Math.min(5, gameQuestions.length);
    for (let i = 0; i < preloadCount; i++) {
        const question = gameQuestions[i];
        if (question.image) {
            const imageSrc = getImageSrc(question.image);
            if (imageSrc) {
                imagesToPreload.push(imageSrc);
            }
        }
    }
    
    // 显示加载进度条
    const loadingOverlay = document.getElementById('loading-overlay');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    
    if (imagesToPreload.length > 0) {
        loadingOverlay.style.display = 'flex';
        progressBar.style.width = '0%';
        progressText.textContent = '0%';
        
        let loadedCount = 0;
        
        // 并行加载图片
        await Promise.all(imagesToPreload.map(imageSrc => {
            return imageLoader.loadImageWithRetry(imageSrc)
                .catch(error => {
                    console.error('预加载图片失败:', error);
                    // 预加载失败不影响游戏开始
                    return null;
                })
                .finally(() => {
                    loadedCount++;
                    const progress = Math.floor((loadedCount / imagesToPreload.length) * 100);
                    progressBar.style.width = `${progress}%`;
                    progressText.textContent = `${progress}%`;
                });
        }));
        
        // 隐藏加载进度条
        loadingOverlay.style.display = 'none';
    }
    
    // 预加载完成后显示游戏页面
    showGamePage();
}

// 网络状态管理器
class NetworkManager {
    constructor() {
        this.currentNetworkType = 'unknown';
        this.isOnline = navigator.onLine;
        this.networkQuality = 'good';
        this.initNetworkListeners();
    }

    // 初始化网络监听器
    initNetworkListeners() {
        // 监听在线/离线状态变化
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('网络已连接');
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('网络已断开');
            // 可以在这里添加更友好的网络断开提示，例如在页面上显示一个提示条
        });

        // 监听网络类型变化
        if ('connection' in navigator) {
            const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            
            const updateNetworkInfo = () => {
                this.currentNetworkType = connection.effectiveType || 'unknown';
                this.networkQuality = this.getNetworkQuality(connection);
                console.log(`网络类型: ${this.currentNetworkType}, 质量: ${this.networkQuality}`);
            };

            updateNetworkInfo();
            connection.addEventListener('change', updateNetworkInfo);
        }
    }

    // 根据网络连接获取网络质量
    getNetworkQuality(connection) {
        const downlink = connection.downlink || 10;
        const rtt = connection.rtt || 50;
        
        if (downlink < 1 || rtt > 500) {
            return 'poor';
        } else if (downlink < 3 || rtt > 200) {
            return 'medium';
        } else {
            return 'good';
        }
    }

    // 获取当前网络质量
    getCurrentQuality() {
        return this.networkQuality;
    }

    // 获取当前网络类型
    getCurrentType() {
        return this.currentNetworkType;
    }

    // 检查是否在线
    checkOnline() {
        return this.isOnline;
    }

    // 根据网络质量获取图片加载配置
    getImageLoadConfig() {
        const configs = {
            good: {
                quality: 0.8,
                timeout: 10000,
                maxRetries: 3
            },
            medium: {
                quality: 0.6,
                timeout: 15000,
                maxRetries: 2
            },
            poor: {
                quality: 0.4,
                timeout: 20000,
                maxRetries: 1
            }
        };
        return configs[this.networkQuality] || configs.good;
    }
}

// 图片懒加载管理器
class ImageLazyLoader {
    constructor(networkManager) {
        this.loadedImages = new Set();
        this.imageCache = new Map();
        this.networkManager = networkManager;
        this.maxCacheSize = 50; // 设置最大缓存容量
        this.cacheUsage = 0;
    }
    
    // 清理图片缓存，移除最旧的缓存项
    cleanupCache() {
        if (this.imageCache.size > this.maxCacheSize) {
            // 获取最旧的缓存项（Map按插入顺序迭代）
            const oldestKey = this.imageCache.keys().next().value;
            this.imageCache.delete(oldestKey);
            this.loadedImages.delete(oldestKey);
            this.cacheUsage = this.imageCache.size;
            console.log(`图片缓存已清理，当前缓存大小: ${this.cacheUsage}/${this.maxCacheSize}`);
        }
    }

    // 加载图片并处理失败重试
    loadImageWithRetry(imageSrc, maxRetries = null, retryDelay = 1000) {
        // 获取网络质量相关配置
        const networkConfig = this.networkManager.getImageLoadConfig();
        maxRetries = maxRetries !== null ? maxRetries : networkConfig.maxRetries;
        const timeout = networkConfig.timeout;

        return new Promise((resolve, reject) => {
            let retries = 0;
            let timeoutId;

            const loadImage = () => {
                // 检查缓存
                if (this.imageCache.has(imageSrc)) {
                    resolve(this.imageCache.get(imageSrc));
                    return;
                }

                // 检查网络状态
                if (!this.networkManager.checkOnline()) {
                    reject(new Error('网络连接已断开'));
                    return;
                }

                const img = new Image();
                
                img.onload = () => {
                    clearTimeout(timeoutId);
                    this.loadedImages.add(imageSrc);
                    
                    // 在添加新缓存前清理超出容量的旧缓存
                    this.cleanupCache();
                    
                    this.imageCache.set(imageSrc, img);
                    this.cacheUsage = this.imageCache.size;
                    resolve(img);
                };
                
                img.onerror = () => {
                    clearTimeout(timeoutId);
                    retries++;
                    if (retries <= maxRetries) {
                        console.log(`图片加载失败，正在重试 (${retries}/${maxRetries}):`, imageSrc);
                        setTimeout(loadImage, retryDelay);
                    } else {
                        console.error(`图片加载多次失败:`, imageSrc);
                        reject(new Error(`图片加载失败: ${imageSrc}`));
                    }
                };
                
                // 设置超时
                timeoutId = setTimeout(() => {
                    img.onerror(new Error(`图片加载超时 (${timeout}ms): ${imageSrc}`));
                }, timeout);
                
                img.src = imageSrc;
            };
            
            loadImage();
        });
    }

    // 预加载图片（用于游戏开始前）
    async preloadImages(imageUrls) {
        const promises = imageUrls.map(url => 
            this.loadImageWithRetry(url).catch(err => {
                console.error(`预加载图片失败:`, err);
                return null;
            })
        );
        return Promise.all(promises);
    }

    // 检查图片是否已加载
    isLoaded(imageSrc) {
        return this.loadedImages.has(imageSrc);
    }
}

// 页面历史记录管理
let pageHistory = [];
const MAIN_PAGE = 'main-page';

// 处理返回键逻辑
function handleBackButton() {
    // 如果当前页面不是主页面，返回上一个页面
    if (currentPage !== MAIN_PAGE) {
        // 移除当前页面
        pageHistory.pop();
        // 导航到上一个页面，如果没有上一个页面则导航到主页面
        const prevPage = pageHistory.length > 0 ? pageHistory[pageHistory.length - 1] : MAIN_PAGE;
        
        // 显示上一个页面
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        document.getElementById(prevPage).classList.add('active');
        currentPage = prevPage;
        
        // 确保页面历史记录正确
        if (pageHistory.length === 0) {
            pageHistory.push(MAIN_PAGE);
        }
        
        return true; // 表示已处理返回键
    }
    return false; // 表示未处理返回键，使用默认行为
}

// 初始化返回键监听
function initBackButtonListener() {
    // 监听浏览器历史记录变化事件（包括返回键）
    window.addEventListener('popstate', function(e) {
        // 阻止默认行为
        e.preventDefault();
        // 处理返回键逻辑
        handleBackButton();
    });
    
    // 初始化页面历史记录
    pageHistory = [MAIN_PAGE];
    
    // 初始化浏览器历史记录
    history.replaceState({ page: MAIN_PAGE }, '', '');
}

// 初始化网络管理器和图片懒加载管理器
let networkManager;
let imageLoader;

// 显示游戏页面
function showGamePage() {
    showPage('game-page');
    
    // 添加防御性检查，确保游戏数据有效
    if (!gameQuestions || gameQuestions.length === 0) {
        console.error('游戏题目列表为空');
        document.getElementById('game-text').textContent = '游戏数据错误，请返回首页';
        return;
    }
    
    // 先移除可能存在的事件监听器，避免重复绑定
    window.removeEventListener('keydown', handleKeyDown);
    // 添加新的事件监听器
    window.addEventListener('keydown', handleKeyDown);
    
    // 确保gameIndex在有效范围内
    gameIndex = Math.max(0, Math.min(gameIndex, gameQuestions.length - 1));
    
    const currentQ = gameQuestions[gameIndex];
    
    // 更新游戏信息
    const questionId = currentQ.id || (gameIndex + 1); // 优先使用json中的id，若不存在则使用索引+1作为备选
    document.getElementById('game-id').textContent = `ID ${questionId}`;
    document.getElementById('game-author').textContent = `作者: ${gameAuthor || '未知'}`;
    
    // 设置图片和文本
    document.getElementById('game-text').textContent = currentQ.question || '这是____';
    
    // 根据答案长度动态生成输入框
    const answerSection = document.querySelector('.answer-section');
    const existingInputsContainer = answerSection.querySelector('.answer-inputs');
    
    // 移除现有的输入框容器
    if (existingInputsContainer) {
        existingInputsContainer.remove();
    }
    
    // 创建新的输入框容器
    const newInputsContainer = document.createElement('div');
    newInputsContainer.className = 'answer-inputs';
    
    // 获取答案长度，默认为4
    const answerLength = currentQ.answer ? currentQ.answer.length : 4;
    
    // 生成对应数量的输入框
    for (let i = 0; i < answerLength; i++) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'answer-input';
        input.placeholder = '';
        input.style.textTransform = 'uppercase'; // 自动转换为大写（可选）
        
        // 输入法状态跟踪
        let isComposing = false;
        
        // 监听输入法开始
        input.addEventListener('compositionstart', function() {
            isComposing = true;
        });
        
        // 监听输入法结束
        input.addEventListener('compositionend', function(e) {
            isComposing = false;
            // 输入法结束后，处理输入的内容
            handleMultiCharacterInput(this, this.value);
        });
        
        // 添加输入事件监听，处理多字符输入
        input.addEventListener('input', function(e) {
            // 处理输入的内容，支持多字符自动分配
            if (!isComposing) {
                handleMultiCharacterInput(this, this.value);
            }
        });
        
        // 添加键盘事件监听，支持退格键导航
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Backspace') {
                if (this.value.length === 0) {
                    // 当前输入框为空，退格键聚焦到上一个输入框
                    const prevInput = this.previousElementSibling;
                    if (prevInput) {
                        prevInput.focus();
                        prevInput.value = '';
                    }
                } else {
                    // 当前输入框有内容，退格键清空当前输入框
                    this.value = '';
                }
            }
        });
        
        newInputsContainer.appendChild(input);
    }
    
    // 将新生成的输入框容器添加到答题区域
    const answerButtons = answerSection.querySelector('.answer-buttons');
    answerSection.insertBefore(newInputsContainer, answerButtons);
    
    // 仅针对电脑版，自动聚焦第一个输入框
    if (window.innerWidth > 768) {
        const firstInput = newInputsContainer.querySelector('.answer-input');
        if (firstInput) {
            setTimeout(() => {
                firstInput.focus();
            }, 100);
        }
    }
    
    // 初始化或清空错误答案数组
    window.wrongAnswers = [];
    
    // 清空错误答案显示
    const wrongAnswersContainer = document.getElementById('wrong-answers');
    wrongAnswersContainer.innerHTML = '';
    
    document.getElementById('result-text').textContent = '';
    document.getElementById('next-btn-container').style.display = 'none';
    
    // 处理图片显示
    const gameImage = document.getElementById('game-image');
    if (currentQ.image) {
        // 使用公共函数处理图片URL
        const imageSrc = getImageSrc(currentQ.image);
        
        // 清除之前的事件监听器
        gameImage.onload = null;
        gameImage.onerror = null;
        
        // 显示加载状态
        gameImage.style.display = 'block';
        gameImage.src = ''; // 清空当前图片
        gameImage.classList.add('loading');
        document.getElementById('result-text').textContent = '图片加载中...';
        
        // 使用懒加载管理器加载当前题目的图片
        imageLoader.loadImageWithRetry(imageSrc)
            .then(() => {
                // 图片加载成功，设置到游戏图片元素
                gameImage.onload = () => {
                    gameImage.classList.remove('loading');
                    document.getElementById('result-text').textContent = '';
                    gameImage.style.display = 'block';
                };
                
                gameImage.onerror = () => {
                    console.error('游戏图片加载失败:', imageSrc);
                    gameImage.classList.remove('loading');
                    gameImage.style.display = 'none';
                    document.getElementById('result-text').textContent = '图片加载失败，请检查网络连接或图片URL';
                };
                
                gameImage.src = imageSrc;
                
                // 预加载下两题的图片（如果存在）
                for (let i = 1; i <= 2; i++) {
                    const nextIndex = gameIndex + i;
                    if (nextIndex < gameQuestions.length) {
                        const nextQ = gameQuestions[nextIndex];
                        if (nextQ.image) {
                            const nextImageSrc = getImageSrc(nextQ.image);
                            imageLoader.loadImageWithRetry(nextImageSrc)
                                .catch(error => {
                                    console.error(`预加载第${nextIndex + 1}题图片失败:`, error);
                                    // 预加载失败不影响当前游戏，只记录日志
                                });
                        }
                    }
                }
            })
            .catch(error => {
                console.error('使用懒加载加载图片失败:', error);
                gameImage.classList.remove('loading');
                gameImage.style.display = 'none';
                document.getElementById('result-text').textContent = '图片加载失败，请检查网络连接或图片URL';
            });
    } else {
        gameImage.src = '';
        gameImage.style.display = 'none';
        
        // 预加载下两题的图片（如果存在）
        for (let i = 1; i <= 2; i++) {
            const nextIndex = gameIndex + i;
            if (nextIndex < gameQuestions.length) {
                const nextQ = gameQuestions[nextIndex];
                if (nextQ.image) {
                    const nextImageSrc = getImageSrc(nextQ.image);
                    imageLoader.loadImageWithRetry(nextImageSrc)
                        .catch(error => {
                            console.error(`预加载第${nextIndex + 1}题图片失败:`, error);
                            // 预加载失败不影响当前游戏，只记录日志
                        });
                }
            }
        }
    }
    
    answeredCurrent = false;
}

// 处理多字符输入，自动分配到后面的输入框
function handleMultiCharacterInput(currentInput, inputValue) {
    if (!inputValue) return;
    
    // 获取所有输入框
    const allInputs = Array.from(document.querySelectorAll('.answer-input'));
    const currentIndex = allInputs.indexOf(currentInput);
    
    if (currentIndex === -1) return;
    
    // 清除当前输入框及后面所有输入框的内容
    for (let i = currentIndex; i < allInputs.length; i++) {
        allInputs[i].value = '';
    }
    
    // 将输入内容分配到当前及后面的输入框
    let charIndex = 0;
    for (let i = currentIndex; i < allInputs.length && charIndex < inputValue.length; i++) {
        allInputs[i].value = inputValue[charIndex];
        charIndex++;
    }
    
    // 聚焦到最后一个有内容的输入框的下一个输入框
    const nextIndex = Math.min(currentIndex + inputValue.length, allInputs.length - 1);
    if (charIndex < inputValue.length) {
        // 如果输入内容还有剩余，聚焦到最后一个输入框
        allInputs[allInputs.length - 1].focus();
    } else {
        // 否则聚焦到下一个空输入框
        const nextInput = allInputs[nextIndex];
        if (nextInput) {
            nextInput.focus();
        }
    }
}

// 回车键处理函数 - 移到外部确保函数实例唯一
function handleKeyDown(e) {
    if (e.key === 'Enter' && currentPage === 'game-page' && !answeredCurrent) {
        e.preventDefault(); // 阻止回车键的默认行为
        checkAnswer();
    }
}

// 检查答案
function checkAnswer() {
    if (answeredCurrent) return;
    
    // 获取输入框的答案
    const answerInputs = document.querySelectorAll('.answer-input');
    let userAnswer = '';
    answerInputs.forEach(input => {
        userAnswer += input.value.trim();
    });
    
    const correctAnswer = gameQuestions[gameIndex].answer;
    attemptCount++;
    
    if (userAnswer.toLowerCase() === correctAnswer.toLowerCase()) {
        correctCount++;
        answeredCurrent = true;
        soundManager.playSound('win');
        document.getElementById('result-text').textContent = '答对啦！太棒了！';
        document.getElementById('next-btn-container').style.display = 'block';
        
        // 在手机端自动下拉到最下面
        if (window.innerWidth <= 768) {
            setTimeout(() => {
                // 尝试多种滚动方式确保兼容性
                const appContainer = document.getElementById('app');
                if (appContainer) {
                    appContainer.scrollTo({ top: appContainer.scrollHeight, behavior: 'smooth' });
                }
                // 同时滚动window以确保效果
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                document.documentElement.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
            }, 100);
        }
    } else {
        // 处理错误答案
        if (soundManager.ghostMode) {
            // 真的假的模式：当前题打错次数 + 随机0-12次
            const wrongCount = window.wrongAnswers.length; // 当前题的打错次数
            const randomAdd = Math.floor(Math.random() * 12) + 1; // 随机0-12次
            const playCount = wrongCount + randomAdd;
            
            for (let i = 0; i < playCount; i++) {
                const delay = Math.random() * 0.9 + 0.1; // 0.1-1秒延迟
                setTimeout(() => {
                    soundManager.playSound('lose');
                }, delay * 1000 * i); // 累积延迟，实现重叠播放效果
            }
        } else {
            // 普通模式：只播放一次lose音效
            soundManager.playSound('lose');
        }
        
        document.getElementById('result-text').textContent = '答错啦~';
        
        // 添加错误答案到数组
        window.wrongAnswers.push(userAnswer);
        
        // 限制最多显示3个错误答案
        if (window.wrongAnswers.length > 3) {
            window.wrongAnswers.shift(); // 移除最早的错误答案
        }
        
        // 更新错误答案显示
        updateWrongAnswersDisplay();
    }
}

// 更新错误答案显示
function updateWrongAnswersDisplay() {
    const wrongAnswersContainer = document.getElementById('wrong-answers');
    wrongAnswersContainer.innerHTML = '';
    
    // 获取当前题目的正确答案
    const correctAnswer = gameQuestions[gameIndex].answer;
    
    // 遍历错误答案数组，创建显示元素
    window.wrongAnswers.forEach(answer => {
        const wrongAnswerItem = document.createElement('div');
        wrongAnswerItem.className = 'wrong-answer-item';
        
        // 将错误答案拆分为单个字符，每个字符放在一个char-box中
        for (let i = 0; i < answer.length; i++) {
            const charBox = document.createElement('div');
            charBox.className = 'char-box';
            charBox.textContent = answer[i];
            
            // 检查当前字符是否与正确答案对应位置的字符匹配
            if (i < correctAnswer.length && answer[i].toLowerCase() === correctAnswer[i].toLowerCase()) {
                charBox.classList.add('char-correct');
            }
            
            wrongAnswerItem.appendChild(charBox);
        }
        
        wrongAnswersContainer.appendChild(wrongAnswerItem);
    });
}

// 显示公告
function showAnnouncement() {
    document.getElementById('announcement-modal').style.display = 'flex';
}

function closeAnnouncementModal() {
    document.getElementById('announcement-modal').style.display = 'none';
}

// 显示帮助
function showHelp() {
    document.getElementById('help-modal').style.display = 'flex';
}

function closeHelpModal() {
    document.getElementById('help-modal').style.display = 'none';
}

// 显示彩蛋弹窗
function showEasterEggModal() {
    document.getElementById('easter-egg-modal').style.display = 'flex';
}

// 关闭彩蛋弹窗
function closeEasterEggModal() {
    document.getElementById('easter-egg-modal').style.display = 'none';
}

// 显示导出成功弹窗
function showExportSuccessModal() {
    document.getElementById('export-success-modal').style.display = 'flex';
}

// 关闭导出成功弹窗
function closeExportSuccessModal() {
    document.getElementById('export-success-modal').style.display = 'none';
}



// 显示提示
function showHint() {
    const hint = gameQuestions[gameIndex].hint;
    document.getElementById('result-text').textContent = hint ? `提示: ${hint}` : '这道题没有提示哦~';
}

// 放弃
function giveUp() {
    if (answeredCurrent) return;
    
    gaveUpCount++;
    answeredCurrent = true;
    const correctAnswer = gameQuestions[gameIndex].answer;
    document.getElementById('result-text').textContent = `正确答案是: ${correctAnswer}`;
    document.getElementById('next-btn-container').style.display = 'block';
    
    // 在手机端自动下拉到最下面
    if (window.innerWidth <= 768) {
        setTimeout(() => {
            // 尝试多种滚动方式确保兼容性
            const appContainer = document.getElementById('app');
            if (appContainer) {
                appContainer.scrollTo({ top: appContainer.scrollHeight, behavior: 'smooth' });
            }
            // 同时滚动window以确保效果
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            document.documentElement.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
        }, 100);
    }
}

// 下一题
function nextQuestion() {
    gameIndex++;
    if (gameIndex >= gameQuestions.length) {
        showGameComplete();
    } else {
        showGamePage();
    }
}

// 显示游戏完成
function showGameComplete() {
    showPage('complete-page');
    soundManager.playSound('clear');
    
    // 标记当前题库为已玩过
    if (gameBank && gameBank.id) {
        markBankAsPlayed(gameBank.id);
    }
    
    const total = gameQuestions.length;
    const accuracy = total > 0 ? (correctCount / total * 100).toFixed(1) : 0;
    
    document.getElementById('stats-correct').textContent = `答对: ${correctCount}`;
    document.getElementById('stats-wrong').textContent = `答错/放弃: ${total - correctCount}`;
    document.getElementById('stats-accuracy').textContent = `正确率: ${accuracy}%`;
}

// 全局函数 - 切换背景音乐
function toggleBgm() {
    const isPlaying = soundManager.toggleBgm();
    // 该函数用于切换背景音乐，按钮图标由SoundManager内部更新
}

// 新增：加载初始题库（从banks文件夹导入）
async function loadInitialBanks() {
    // 定义初始题库文件路径 - 包括所有banks文件夹中的JSON文件
    const initialBankFiles = [
        'banks/第一期重制版.json',
        'banks/拼好团DLC.json',
        'banks/码头笑话DLC.json'
    ];

    // 遍历并导入每个初始题库
    for (const filePath of initialBankFiles) {
        try {
            // 请求JSON文件
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`加载 ${filePath} 失败: ${response.status}`);
            }
            const bankData = await response.json();

            // 导入题库（importBank会自动处理同名替换）
            const importResult = QuestionBank.importBank(JSON.stringify(bankData));
            if (importResult.success) {
                console.log(`初始题库 "${bankData.name}" 导入成功`);
            } else {
                console.error(`导入 ${filePath} 失败: ${importResult.message}`);
            }
        } catch (error) {
            console.error(`处理 ${filePath} 时出错:`, error);
        }
    }
    
    // 清理localStorage中特定的旧题库
    // 只删除已确定需要移除的旧题库，保留所有其他题库（包括用户自己创建的）
    const banksToRemove = ['第一期_updated', '第二期_updated'];
    
    // 2. 获取当前localStorage中的所有题库
    let currentBanks = QuestionBank.getAllBanks();
    
    // 3. 过滤掉需要移除的旧题库
    const filteredBanks = currentBanks.filter(bank => !banksToRemove.includes(bank.name));
    
    // 4. 保存过滤后的题库到localStorage
    if (filteredBanks.length !== currentBanks.length) {
        QuestionBank.saveBanks(filteredBanks);
        console.log(`已清理${currentBanks.length - filteredBanks.length}个旧题库`);
    }
}

// 修改初始化逻辑：在DOM加载完成后调用loadInitialBanks
window.addEventListener('DOMContentLoaded', () => {
    // 初始化音效管理器
    soundManager = new SoundManager();
    
    // 初始化网络管理器
    networkManager = new NetworkManager();
    
    // 初始化图片懒加载管理器
    imageLoader = new ImageLazyLoader(networkManager);
    
    // 初始化返回键监听
    initBackButtonListener();
    
    // 加载初始题库（关键新增）
    loadInitialBanks().then(() => {
        // 初始题库加载完成后，初始化页面
        showMainPage();
    });
});

// 响应式缩放
function handleResize() {
    // 获取窗口尺寸
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // 针对不同屏幕尺寸进行简单的响应式调整
    const appContainer = document.getElementById('app');
    if (appContainer) {
        // 确保app容器适应屏幕尺寸
        if (windowWidth < 768) {
            // 移动设备，调整容器大小和内边距
            appContainer.style.padding = '10px';
        } else {
            // 桌面设备，使用默认样式
            appContainer.style.padding = '';
        }
    }
    
    // 调整游戏图片容器的大小
    const gameImageContainer = document.getElementById('game-image-container');
    if (gameImageContainer) {
        const maxWidth = windowWidth * 0.45;
        const maxHeight = windowHeight * 0.6;
        gameImageContainer.style.maxWidth = `${maxWidth}px`;
        gameImageContainer.style.maxHeight = `${maxHeight}px`;
    }
    
    // 调整游戏容器的布局
    const gameContainer = document.querySelector('.game-container');
    if (gameContainer) {
        if (windowWidth < 1024) {
            // 小屏幕设备，使用垂直布局
            gameContainer.style.flexDirection = 'column';
        } else {
            // 大屏幕设备，使用水平布局
            gameContainer.style.flexDirection = 'row';
        }
    }
}

// 响应式缩放事件监听
window.addEventListener('resize', handleResize);

// 页面加载时初始化响应式布局
window.addEventListener('load', handleResize);