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

// 页面切换函数
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
    currentPage = pageId;
}

function showMainPage() {
    showPage('main-page');
}

function showSettingsPage() {
    showPage('settings-page');
}

function showManagePage() {
    showPage('manage-page');
    refreshBankList();
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
        this.bgmVolume = 0.5;
        this.sfxVolume = 0.5;
        this.sounds = {};
        this.bgm = null;
        this.bgmPlaying = false;
        this.loadSounds();
        this.setupEventListeners();
        this.setupButtonClickSounds();
        this.updateBgmButton();
    }
    
    updateBgmButton() {
        const btn = document.getElementById('bgm-toggle-btn');
        if (btn) {
            btn.innerHTML = this.bgmPlaying ? '🔊' : '🔇';
        }
    }

    loadSounds() {
        // 音效文件路径
        const soundFiles = {
            'win': 'win.wav',
            'lose': 'lose.wav',
            'clear': 'clear.wav',
            'click': 'click.wav'
        };

        // 加载音效
        for (const [name, filename] of Object.entries(soundFiles)) {
            const audio = new Audio(filename);
            audio.volume = this.sfxVolume;
            this.sounds[name] = audio;
        }

        // 加载背景音乐
        this.bgm = new Audio('bgm.mp3');
        this.bgm.volume = this.bgmVolume;
        this.bgm.loop = true;
    }

    playBgm() {
        if (this.bgm) {
            this.bgm.play().catch(e => {
                console.log('背景音乐播放失败:', e);
            });
            this.bgmPlaying = true;
        }
    }

    pauseBgm() {
        if (this.bgm) {
            this.bgm.pause();
            this.bgmPlaying = false;
        }
    }

    toggleBgm() {
        if (this.bgmPlaying) {
            this.pauseBgm();
        } else {
            this.playBgm();
        }
        this.updateBgmButton();
        return this.bgmPlaying;
    }

    setBgmVolume(volume) {
        this.bgmVolume = volume;
        if (this.bgm) {
            this.bgm.volume = volume;
        }
    }

    setSfxVolume(volume) {
        this.sfxVolume = volume;
        for (const audio of Object.values(this.sounds)) {
            audio.volume = volume;
        }
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
        // 音量控制
        const bgmVolumeSlider = document.getElementById('bgm-volume');
        const sfxVolumeSlider = document.getElementById('sfx-volume');

        bgmVolumeSlider.addEventListener('input', (e) => {
            this.setBgmVolume(parseFloat(e.target.value));
        });

        sfxVolumeSlider.addEventListener('input', (e) => {
            this.setSfxVolume(parseFloat(e.target.value));
        });
    }

    setupButtonClickSounds() {
        // 为所有圆角按钮添加点击音效
        const buttons = document.querySelectorAll('.rounded-button');
        buttons.forEach(button => {
            button.addEventListener('click', () => {
                this.playSound('click');
            });
        });
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

    static imageToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64String = e.target.result.split(',')[1];
                resolve(base64String);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    static base64ToImage(base64Str) {
        return `data:image/jpeg;base64,${base64Str}`;
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
                id: Date.now(),
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
function refreshBankList() {
    const bankList = document.getElementById('bank-list');
    bankList.innerHTML = '';
    
    const banks = QuestionBank.getAllBanks();
    
    if (banks.length === 0) {
        bankList.innerHTML = '<div class="outlined-text" style="margin: 50px;text-align: center;">暂无题库</div>';
        return;
    }
    
    banks.forEach(bank => {
        const bankItem = createBankItem(bank, true);
        bankList.appendChild(bankItem);
    });
}

// 刷新选择题库列表
function refreshSelectBankList() {
    const bankList = document.getElementById('select-bank-list');
    bankList.innerHTML = '';
    
    const banks = QuestionBank.getAllBanks();
    
    if (banks.length === 0) {
        bankList.innerHTML = '<div class="outlined-text" style="margin: 50px;text-align: center;">暂无题库，请先添加</div>';
        return;
    }
    
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
    infoDiv.innerHTML = `<div class="outlined-text">${bank.name}    作者：${bank.author}    题目：${bank.count}道</div>`;
    
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
        
        btnDiv.appendChild(selectBtn);
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
            // 检查是否是URL（以http://或https://开头）
            let imageSrc = '';
            if (imgData.startsWith('http://') || imgData.startsWith('https://')) {
                // 是完整URL，直接使用
                imageSrc = imgData;
            } else if (imgData.includes('\\') || imgData.includes('/')) {
                // 是本地文件路径，构建完整URL
                imageSrc = `banks/${imgData.replace(/\\/g, '/')}`;
            } else {
                // 是base64编码，转换为data URL
                imageSrc = QuestionBank.base64ToImage(imgData);
            }
            
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
                // 可以在这里添加加载失败的提示
                alert('图片加载失败，请检查网络连接或图片URL');
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

// 保存编辑题
function saveEditorQuestion() {
    if (editIndex >= 0 && editIndex < editQuestions.length) {
        editQuestions[editIndex] = {
            image: editQuestions[editIndex].image || '',
            question: document.getElementById('edit-question').value.trim(),
            answer: document.getElementById('edit-answer').value.trim(),
            hint: document.getElementById('edit-hint').value.trim()
        };
    }
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
            const base64Data = await QuestionBank.imageToBase64(file);
            editQuestions[editIndex].image = base64Data;
            loadEditorQuestion();
        } catch (error) {
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
    if (editIndex < editQuestions.length - 1) {
        saveEditorQuestion();
        editIndex++;
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
    editQuestions[editIndex] = {'image': '', 'question': '', 'answer': '', 'hint': ''};
    loadEditorQuestion();
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
    
    if (editingBank) {
        QuestionBank.updateBank(editingBank.id, bankName, author, validQuestions);
    } else {
        QuestionBank.saveBank(bankName, author, validQuestions);
    }
    
    alert('保存成功！');
    showManagePage();
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
                refreshBankList();
            } else {
                alert(result.message);
            }
        };
        reader.readAsText(file);
    }
});

// 导出题库
function exportBank(bank) {
    const dataStr = JSON.stringify(bank, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${bank.name}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

// 删除题库
function deleteBank(bank) {
    if (confirm(`确定删除题库 '${bank.name}' 吗？`)) {
        QuestionBank.deleteBank(bank.id);
        refreshBankList();
    }
}

// 开始游戏
function startGame(bank) {
    gameBank = bank;
    gameQuestions = JSON.parse(JSON.stringify(bank.questions));
    gameAuthor = bank.author || '未知';
    gameIndex = 0;
    correctCount = 0;
    attemptCount = 0;
    gaveUpCount = 0;
    answeredCurrent = false;
    showGamePage();
}

// 显示游戏页面
function showGamePage() {
    showPage('game-page');
    
    const currentQ = gameQuestions[gameIndex];
    
    // 更新游戏信息
    document.getElementById('game-author').textContent = `作者：${gameAuthor}`;
    document.getElementById('game-progress').textContent = `第 ${gameIndex + 1} / ${gameQuestions.length} 题`;
    
    // 设置问题和图片
    document.getElementById('game-question').textContent = currentQ.question || '猜猜这是什么？';
    document.getElementById('game-answer-input').value = '';
    document.getElementById('result-text').textContent = '';
    document.getElementById('next-btn-container').style.display = 'none';
    
    const gameImage = document.getElementById('game-image');
    if (currentQ.image) {
        // 检查是否是URL（以http://或https://开头）
        let imageSrc = '';
        if (currentQ.image.startsWith('http://') || currentQ.image.startsWith('https://')) {
            // 是完整URL，直接使用
            imageSrc = currentQ.image;
        } else if (currentQ.image.includes('\\') || currentQ.image.includes('/')) {
            // 是本地文件路径，构建完整URL
            imageSrc = `banks/${currentQ.image.replace(/\\/g, '/')}`;
        } else {
            // 是base64编码，转换为data URL
            imageSrc = QuestionBank.base64ToImage(currentQ.image);
        }
        
        // 清除之前的事件监听器
        gameImage.onload = null;
        gameImage.onerror = null;
        
        // 添加图片加载事件处理
        gameImage.onload = () => {
            gameImage.style.display = 'block';
        };
        
        gameImage.onerror = () => {
            console.error('图片加载失败:', imageSrc);
            gameImage.style.display = 'none';
            // 可以在这里添加加载失败的提示
            document.getElementById('result-text').textContent = '图片加载失败，请检查网络连接或图片URL';
        };
        
        // 设置图片源
        gameImage.src = imageSrc;
    } else {
        gameImage.src = '';
        gameImage.style.display = 'none';
    }
    
    answeredCurrent = false;
}

// 检查答案
function checkAnswer() {
    if (answeredCurrent) return;
    
    const userAnswer = document.getElementById('game-answer-input').value.trim();
    const correctAnswer = gameQuestions[gameIndex].answer;
    attemptCount++;
    
    if (userAnswer === correctAnswer) {
        correctCount++;
        answeredCurrent = true;
        soundManager.playSound('win');
        document.getElementById('result-text').textContent = '答对啦！太棒了！';
        document.getElementById('next-btn-container').style.display = 'block';
    } else {
        soundManager.playSound('lose');
        document.getElementById('result-text').textContent = '答错啦~';
    }
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
    
    const total = attemptCount + gaveUpCount;
    const accuracy = total > 0 ? (correctCount / total * 100).toFixed(1) : 0;
    
    document.getElementById('stats-correct').textContent = `答对: ${correctCount}`;
    document.getElementById('stats-wrong').textContent = `答错/放弃: ${total - correctCount}`;
    document.getElementById('stats-accuracy').textContent = `正确率: ${accuracy}%`;
}

// 全局函数 - 切换背景音乐
function toggleBgm() {
    const isPlaying = soundManager.toggleBgm();
    const btn = document.getElementById('bgm-toggle');
    btn.textContent = isPlaying ? '关闭音乐' : '开启音乐';
}

// 新增：加载初始题库（从banks文件夹导入）
async function loadInitialBanks() {
    // 定义初始题库文件路径
    const initialBankFiles = [
        'banks/第一期_updated.json',
        'banks/第二期_updated.json'
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
}

// 修改初始化逻辑：在DOM加载完成后调用loadInitialBanks
window.addEventListener('DOMContentLoaded', () => {
    // 初始化音效管理器
    soundManager = new SoundManager();
    
    // 加载初始题库（关键新增）
    loadInitialBanks().then(() => {
        // 初始题库加载完成后，初始化页面
        showMainPage();
    });
});

// 响应式缩放
window.addEventListener('resize', () => {
    // 可以在这里添加响应式调整逻辑
});