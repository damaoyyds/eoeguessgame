# -*- coding: utf-8 -*-
"""
看图猜词游戏 - EOE Guess v3 (响应式布局)
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import pygame
import json
import os
import shutil
import base64
from datetime import datetime
from PIL import Image, ImageTk, ImageDraw, ImageFont
import sys
import ctypes
import io

# Windows DPI适配
try:
    ctypes.windll.shcore.SetProcessDpiAwareness(2)
except:
    try:
        ctypes.windll.user32.SetProcessDPIAware()
    except:
        pass

# 获取应用根目录
def get_base_path():
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))

def get_resource_path():
    if getattr(sys, 'frozen', False):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))

BASE_PATH = get_base_path()
RESOURCE_PATH = get_resource_path()
BANKS_PATH = os.path.join(BASE_PATH, 'banks')
os.makedirs(BANKS_PATH, exist_ok=True)

# 基础尺寸和宽高比
BASE_WIDTH = 900
BASE_HEIGHT = 700
ASPECT_RATIO = BASE_WIDTH / BASE_HEIGHT

COLORS = {
    'bg': '#FFF8DC',
    'button': '#FFB366',
    'button_hover': '#FF9933',
    'text': '#333333',
    'white': '#FFFFFF',
    'accent': '#FF6B6B',
    'success': '#4CAF50',
    'error': '#FF5252',
    'border': '#DEB887',
}

class SoundManager:
    def __init__(self):
        pygame.mixer.init()
        self.bgm_volume = 0.5
        self.sfx_volume = 0.5
        self.sounds = {}
        self.load_sounds()
        
    def load_sounds(self):
        sound_files = {'win': 'win.wav', 'lose': 'lose.wav', 'clear': 'clear.wav', 'click': 'click.wav'}
        for name, filename in sound_files.items():
            path = os.path.join(RESOURCE_PATH, filename)
            if os.path.exists(path):
                try:
                    self.sounds[name] = pygame.mixer.Sound(path)
                except:
                    pass
    
    def play_bgm(self):
        bgm_path = os.path.join(RESOURCE_PATH, 'bgm.mp3')
        if os.path.exists(bgm_path):
            try:
                pygame.mixer.music.load(bgm_path)
                pygame.mixer.music.set_volume(self.bgm_volume)
                pygame.mixer.music.play(-1)
            except:
                pass
    
    def set_bgm_volume(self, volume):
        self.bgm_volume = volume
        pygame.mixer.music.set_volume(volume)
    
    def set_sfx_volume(self, volume):
        self.sfx_volume = volume
        for sound in self.sounds.values():
            sound.set_volume(volume)
    
    def play_sound(self, name):
        if name in self.sounds:
            self.sounds[name].set_volume(self.sfx_volume)
            self.sounds[name].play()

def create_outlined_text_image(text, font_size=16, text_color='#333333', outline_color='#FFFFFF', outline_width=2):
    try:
        font_path = os.path.join(RESOURCE_PATH, 'front.ttf')
        if os.path.exists(font_path):
            font = ImageFont.truetype(font_path, font_size)
        else:
            font = ImageFont.truetype("msyh.ttc", font_size)
    except:
        font = ImageFont.load_default()
    
    dummy_img = Image.new('RGBA', (1, 1))
    dummy_draw = ImageDraw.Draw(dummy_img)
    bbox = dummy_draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0] + outline_width * 2 + 10
    text_height = bbox[3] - bbox[1] + outline_width * 2 + 10
    
    img = Image.new('RGBA', (text_width, text_height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    x, y = outline_width + 5, outline_width + 2
    
    for dx in range(-outline_width, outline_width + 1):
        for dy in range(-outline_width, outline_width + 1):
            if dx != 0 or dy != 0:
                draw.text((x + dx, y + dy), text, font=font, fill=outline_color)
    draw.text((x, y), text, font=font, fill=text_color)
    return img

class OutlinedLabel(tk.Canvas):
    def __init__(self, parent, text, font_size=16, text_color='#333333', 
                 outline_color='#FFFFFF', outline_width=2, **kwargs):
        self.text = text
        self.font_size = font_size
        self.text_color = text_color
        self.outline_color = outline_color
        self.outline_width = outline_width
        
        self.text_image = create_outlined_text_image(text, font_size, text_color, outline_color, outline_width)
        self.photo = ImageTk.PhotoImage(self.text_image)
        
        super().__init__(parent, width=self.photo.width(), height=self.photo.height(),
                        highlightthickness=0, **kwargs)
        try:
            self.configure(bg=parent.cget('bg'))
        except:
            pass
        self.create_image(0, 0, anchor='nw', image=self.photo)
    
    def set_text(self, text):
        self.text = text
        self.text_image = create_outlined_text_image(text, self.font_size, self.text_color, self.outline_color, self.outline_width)
        self.photo = ImageTk.PhotoImage(self.text_image)
        self.configure(width=self.photo.width(), height=self.photo.height())
        self.delete('all')
        self.create_image(0, 0, anchor='nw', image=self.photo)

class RoundedButton(tk.Canvas):
    def __init__(self, parent, text, command=None, width=200, height=50, 
                 bg_color=COLORS['button'], hover_color=COLORS['button_hover'],
                 text_color=COLORS['text'], font_size=14, radius=15, **kwargs):
        super().__init__(parent, width=width, height=height, highlightthickness=0, **kwargs)
        self.command = command
        self.bg_color = bg_color
        self.hover_color = hover_color
        self.text_color = text_color
        self.text = text
        self.btn_width = width
        self.btn_height = height
        self.radius = radius
        self.font_size = font_size
        
        try:
            self.configure(bg=parent.cget('bg'))
        except:
            pass
        
        self.draw_button(self.bg_color)
        self.bind('<Enter>', self.on_enter)
        self.bind('<Leave>', self.on_leave)
        self.bind('<Button-1>', self.on_click)
    
    def draw_button(self, color):
        self.delete('all')
        self.create_rounded_rect(2, 2, self.btn_width-2, self.btn_height-2, self.radius, fill=color, outline='#FFFFFF', width=3)
        text_img = create_outlined_text_image(self.text, self.font_size, self.text_color, '#FFFFFF', 2)
        self.text_photo = ImageTk.PhotoImage(text_img)
        self.create_image(self.btn_width//2, self.btn_height//2, image=self.text_photo, anchor='center')
    
    def create_rounded_rect(self, x1, y1, x2, y2, radius, **kwargs):
        points = [x1+radius, y1, x2-radius, y1, x2, y1, x2, y1+radius, x2, y2-radius, x2, y2, x2-radius, y2, x1+radius, y2, x1, y2, x1, y2-radius, x1, y1+radius, x1, y1]
        return self.create_polygon(points, smooth=True, **kwargs)
    
    def on_enter(self, event):
        self.draw_button(self.hover_color)
    
    def on_leave(self, event):
        self.draw_button(self.bg_color)
    
    def on_click(self, event):
        if self.command:
            root = self.winfo_toplevel()
            if hasattr(root, 'sound_manager'):
                root.sound_manager.play_sound('click')
            self.command()

class ImageButton(tk.Canvas):
    """可点击的图片区域按钮"""
    def __init__(self, parent, text="点击上传图片", command=None, width=300, height=250, **kwargs):
        super().__init__(parent, width=width, height=height, bg=COLORS['bg'], 
                        highlightthickness=2, highlightbackground=COLORS['border'], **kwargs)
        self.command = command
        self.btn_width = width
        self.btn_height = height
        self.default_text = text
        self.current_image = None
        
        self.draw_default()
        self.bind('<Button-1>', self.on_click)
        self.bind('<Enter>', self.on_enter)
        self.bind('<Leave>', self.on_leave)
    
    def draw_default(self):
        self.delete('all')
        self.create_rectangle(5, 5, self.btn_width-5, self.btn_height-5, outline=COLORS['border'], dash=(5, 5), width=2)
        text_img = create_outlined_text_image(self.default_text, 16, COLORS['text'], '#FFFFFF', 1)
        self.text_photo = ImageTk.PhotoImage(text_img)
        self.create_image(self.btn_width//2, self.btn_height//2, image=self.text_photo)
    
    def set_image(self, pil_image):
        self.delete('all')
        pil_image.thumbnail((self.btn_width - 20, self.btn_height - 20))
        self.current_image = ImageTk.PhotoImage(pil_image)
        self.create_image(self.btn_width//2, self.btn_height//2, image=self.current_image)
    
    def clear_image(self):
        self.current_image = None
        self.draw_default()
    
    def on_click(self, event):
        if self.command:
            self.command()
    
    def on_enter(self, event):
        self.configure(highlightbackground=COLORS['button'])
    
    def on_leave(self, event):
        self.configure(highlightbackground=COLORS['border'])

class QuestionBank:
    @staticmethod
    def get_all_banks():
        banks = []
        if os.path.exists(BANKS_PATH):
            for f in os.listdir(BANKS_PATH):
                if f.endswith('.json'):
                    filepath = os.path.join(BANKS_PATH, f)
                    try:
                        with open(filepath, 'r', encoding='utf-8') as file:
                            data = json.load(file)
                            banks.append({
                                'filename': f,
                                'name': data.get('name', f.replace('.json', '')),
                                'author': data.get('author', '未知'),
                                'questions': data.get('questions', []),
                                'count': len(data.get('questions', []))
                            })
                    except:
                        pass
        return banks
    
    @staticmethod
    def save_bank(name, author, questions):
        safe_name = "".join(c for c in name if c.isalnum() or c in (' ', '_', '-') or '\u4e00' <= c <= '\u9fff').strip()
        if not safe_name:
            safe_name = datetime.now().strftime('%Y%m%d%H%M%S')
        filename = f"{safe_name}.json"
        filepath = os.path.join(BANKS_PATH, filename)
        idx = 1
        while os.path.exists(filepath):
            filename = f"{safe_name}_{idx}.json"
            filepath = os.path.join(BANKS_PATH, filename)
            idx += 1
        data = {'name': name, 'author': author, 'questions': questions}
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return filename
    
    @staticmethod
    def update_bank(filename, name, author, questions):
        filepath = os.path.join(BANKS_PATH, filename)
        data = {'name': name, 'author': author, 'questions': questions}
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    @staticmethod
    def delete_bank(filename):
        filepath = os.path.join(BANKS_PATH, filename)
        if os.path.exists(filepath):
            os.remove(filepath)
    
    @staticmethod
    def load_bank(filename):
        filepath = os.path.join(BANKS_PATH, filename)
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        return None
    
    @staticmethod
    def import_bank(src_path):
        if not src_path.endswith('.json'):
            return False, "请选择JSON文件"
        try:
            with open(src_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if 'questions' not in data:
                return False, "无效的题库格式"
            filename = os.path.basename(src_path)
            dest_path = os.path.join(BANKS_PATH, filename)
            idx = 1
            name, ext = os.path.splitext(filename)
            while os.path.exists(dest_path):
                filename = f"{name}_{idx}{ext}"
                dest_path = os.path.join(BANKS_PATH, filename)
                idx += 1
            shutil.copy2(src_path, dest_path)
            return True, "导入成功"
        except Exception as e:
            return False, f"导入失败: {str(e)}"
    
    @staticmethod
    def export_bank(filename, dest_dir):
        src_path = os.path.join(BANKS_PATH, filename)
        if os.path.exists(src_path):
            dest_path = os.path.join(dest_dir, filename)
            shutil.copy2(src_path, dest_path)
            return True
        return False
    
    @staticmethod
    def image_to_base64(image_path):
        try:
            with open(image_path, 'rb') as f:
                return base64.b64encode(f.read()).decode('utf-8')
        except:
            return None
    
    @staticmethod
    def base64_to_image(base64_str):
        try:
            image_data = base64.b64decode(base64_str)
            return Image.open(io.BytesIO(image_data))
        except:
            return None

class EOEGuessGame(tk.Tk):
    def __init__(self):
        super().__init__()
        
        self.title("EOE 看图猜词")
        self.geometry(f"{BASE_WIDTH}x{BASE_HEIGHT}")
        self.minsize(640, 500)
        self.resizable(True, True)
        self.configure(bg=COLORS['bg'])
        
        # 设置图标
        icon_path = os.path.join(RESOURCE_PATH, 'icon.png')
        if os.path.exists(icon_path):
            try:
                icon = tk.PhotoImage(file=icon_path)
                self.iconphoto(True, icon)
            except:
                pass
        
        # 原始背景图
        self.original_bg = None
        wallpaper_path = os.path.join(RESOURCE_PATH, 'wallpaper.png')
        if os.path.exists(wallpaper_path):
            try:
                self.original_bg = Image.open(wallpaper_path)
                if self.original_bg.mode != 'RGBA':
                    self.original_bg = self.original_bg.convert('RGBA')
            except:
                pass
        
        self.bg_photo = None
        self.bg_label = None
        self.current_page = None
        self._last_width = BASE_WIDTH
        self._last_height = BASE_HEIGHT
        
        # 音频
        self.sound_manager = SoundManager()
        self.sound_manager.play_bgm()
        
        # 等比例缩放绑定
        self._resize_job = None
        self.bind('<Configure>', self.on_resize)
        
        self.show_main_page()
    
    def get_scale(self):
        """获取当前缩放比例"""
        width = self.winfo_width() or BASE_WIDTH
        return width / BASE_WIDTH
    
    def scaled(self, value):
        """根据缩放比例调整数值"""
        return int(value * self.get_scale())
    
    def on_resize(self, event):
        if event.widget == self:
            # 延迟处理以避免频繁刷新
            if self._resize_job:
                self.after_cancel(self._resize_job)
            self._resize_job = self.after(100, lambda: self.handle_resize(event.width, event.height))
    
    def handle_resize(self, width, height):
        # 等比例缩放
        new_height = int(width / ASPECT_RATIO)
        if new_height != height:
            self.geometry(f"{width}x{new_height}")
            height = new_height
        
        self.update_background(width, height)
        
        # 如果尺寸变化超过阈值，重新渲染页面
        if abs(width - self._last_width) > 20 or abs(height - self._last_height) > 20:
            self._last_width = width
            self._last_height = height
            self._refresh_current_page()
    
    def _refresh_current_page(self):
        """重新渲染当前页面"""
        if self.current_page == 'main':
            self.show_main_page()
        elif self.current_page == 'settings':
            self.show_settings_page()
        elif self.current_page == 'manage':
            self.show_manage_page()
        elif self.current_page == 'select_bank':
            self.show_select_bank_page()
        elif self.current_page == 'game':
            self.show_game_page()
        elif self.current_page == 'edit_bank':
            self._show_edit_bank_page_internal()
        elif self.current_page == 'complete':
            self.show_game_complete()
    
    def update_background(self, width, height):
        if self.original_bg and self.bg_label:
            img = self.original_bg.resize((width, height), Image.Resampling.LANCZOS)
            bg = Image.new('RGBA', img.size, COLORS['bg'])
            img = Image.blend(bg, img, 0.5)
            self.bg_photo = ImageTk.PhotoImage(img)
            self.bg_label.configure(image=self.bg_photo)
    
    def create_background(self, parent):
        width = self.winfo_width() or BASE_WIDTH
        height = self.winfo_height() or BASE_HEIGHT
        
        if self.original_bg:
            img = self.original_bg.resize((width, height), Image.Resampling.LANCZOS)
            bg = Image.new('RGBA', img.size, COLORS['bg'])
            img = Image.blend(bg, img, 0.5)
            self.bg_photo = ImageTk.PhotoImage(img)
            self.bg_label = tk.Label(parent, image=self.bg_photo, bd=0)
            self.bg_label.place(x=0, y=0, relwidth=1, relheight=1)
            return self.bg_label
        return None
    
    def clear_page(self):
        for widget in self.winfo_children():
            widget.destroy()
        self.bg_label = None
    
    def show_main_page(self):
        self.clear_page()
        self.current_page = 'main'
        
        main_frame = tk.Frame(self, bg=COLORS['bg'])
        main_frame.pack(fill='both', expand=True)
        
        self.create_background(main_frame)
        
        # 内容容器（居中）
        content = tk.Frame(main_frame, bg=COLORS['bg'])
        content.place(relx=0.5, rely=0.5, anchor='center')
        
        title = OutlinedLabel(content, "看图猜词", font_size=self.scaled(42), text_color=COLORS['text'], outline_color='#FFFFFF', outline_width=3, bg=COLORS['bg'])
        title.pack(pady=(0, 20))
        
        deco = OutlinedLabel(content, "- * - * -", font_size=self.scaled(24), text_color=COLORS['accent'], outline_color='#FFFFFF', outline_width=2, bg=COLORS['bg'])
        deco.pack(pady=10)
        
        start_btn = RoundedButton(content, "开始游戏", command=self.show_select_bank_page, width=self.scaled(280), height=self.scaled(70), font_size=self.scaled(22))
        start_btn.pack(pady=15)
        
        settings_btn = RoundedButton(content, "设置", command=self.show_settings_page, width=self.scaled(280), height=self.scaled(70), font_size=self.scaled(22))
        settings_btn.pack(pady=15)
        
        # 右上角
        manage_btn = RoundedButton(main_frame, "管理题库", command=self.show_manage_page, width=self.scaled(130), height=self.scaled(45), font_size=self.scaled(12))
        manage_btn.place(relx=0.98, rely=0.02, anchor='ne')
        
        # 底部
        bottom = OutlinedLabel(main_frame, "Made with Love", font_size=self.scaled(14), text_color=COLORS['border'], outline_color='#FFFFFF', outline_width=1, bg=COLORS['bg'])
        bottom.place(relx=0.5, rely=0.97, anchor='s')
    
    def create_home_button(self, parent):
        home_btn = RoundedButton(parent, "返回首页", command=self.show_main_page, width=self.scaled(130), height=self.scaled(45), font_size=self.scaled(12))
        home_btn.place(relx=0.02, rely=0.02, anchor='nw')
    
    def show_settings_page(self):
        self.clear_page()
        self.current_page = 'settings'
        
        main_frame = tk.Frame(self, bg=COLORS['bg'])
        main_frame.pack(fill='both', expand=True)
        
        self.create_background(main_frame)
        self.create_home_button(main_frame)
        
        content = tk.Frame(main_frame, bg=COLORS['bg'])
        content.place(relx=0.5, rely=0.5, anchor='center')
        
        title = OutlinedLabel(content, "设置", font_size=self.scaled(32), text_color=COLORS['text'], outline_color='#FFFFFF', outline_width=3, bg=COLORS['bg'])
        title.pack(pady=(0, 30))
        
        settings_frame = tk.Frame(content, bg=COLORS['white'], relief='solid', bd=2)
        settings_frame.pack(padx=20, pady=10)
        
        inner = tk.Frame(settings_frame, bg=COLORS['white'])
        inner.pack(padx=40, pady=30)
        
        music_label = OutlinedLabel(inner, "背景音乐音量", font_size=self.scaled(16), text_color=COLORS['text'], outline_color='#FFFFFF', outline_width=1, bg=COLORS['white'])
        music_label.pack(pady=(0, 5))
        
        music_scale = ttk.Scale(inner, from_=0, to=1, orient='horizontal', length=self.scaled(300), value=self.sound_manager.bgm_volume, command=lambda v: self.sound_manager.set_bgm_volume(float(v)))
        music_scale.pack(pady=10)
        
        sfx_label = OutlinedLabel(inner, "音效音量", font_size=self.scaled(16), text_color=COLORS['text'], outline_color='#FFFFFF', outline_width=1, bg=COLORS['white'])
        sfx_label.pack(pady=(20, 5))
        
        sfx_scale = ttk.Scale(inner, from_=0, to=1, orient='horizontal', length=self.scaled(300), value=self.sound_manager.sfx_volume, command=lambda v: self.sound_manager.set_sfx_volume(float(v)))
        sfx_scale.pack(pady=10)
    
    def show_manage_page(self):
        self.clear_page()
        self.current_page = 'manage'
        
        main_frame = tk.Frame(self, bg=COLORS['bg'])
        main_frame.pack(fill='both', expand=True)
        
        self.create_background(main_frame)
        self.create_home_button(main_frame)
        
        # 标题
        title = OutlinedLabel(main_frame, "管理题库", font_size=self.scaled(32), text_color=COLORS['text'], outline_color='#FFFFFF', outline_width=3, bg=COLORS['bg'])
        title.place(relx=0.5, rely=0.12, anchor='center')
        
        # 按钮区
        btn_row = tk.Frame(main_frame, bg=COLORS['bg'])
        btn_row.place(relx=0.5, rely=0.22, anchor='center')
        
        add_btn = RoundedButton(btn_row, "新增题库", command=self.show_add_bank_page, width=self.scaled(160), height=self.scaled(50), font_size=self.scaled(14))
        add_btn.pack(side='left', padx=10)
        
        import_btn = RoundedButton(btn_row, "导入题库", command=self.import_bank, width=self.scaled(160), height=self.scaled(50), font_size=self.scaled(14))
        import_btn.pack(side='left', padx=10)
        
        # 列表区
        list_frame = tk.Frame(main_frame, bg=COLORS['bg'])
        list_frame.place(relx=0.5, rely=0.6, anchor='center', relwidth=0.9, relheight=0.55)
        
        canvas = tk.Canvas(list_frame, bg=COLORS['bg'], highlightthickness=0)
        scrollbar = ttk.Scrollbar(list_frame, orient='vertical', command=canvas.yview)
        self.bank_list_frame = tk.Frame(canvas, bg=COLORS['bg'])
        
        self.bank_list_frame.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=self.bank_list_frame, anchor='nw')
        canvas.configure(yscrollcommand=scrollbar.set)
        
        canvas.pack(side='left', fill='both', expand=True)
        scrollbar.pack(side='right', fill='y')
        
        # 绑定鼠标滚轮
        def on_mousewheel(event):
            canvas.yview_scroll(int(-1*(event.delta/120)), "units")
        canvas.bind_all("<MouseWheel>", on_mousewheel)
        
        self.refresh_bank_list()
    
    def refresh_bank_list(self):
        for widget in self.bank_list_frame.winfo_children():
            widget.destroy()
        
        banks = QuestionBank.get_all_banks()
        
        if not banks:
            no_label = OutlinedLabel(self.bank_list_frame, "暂无题库", font_size=self.scaled(16), text_color=COLORS['text'], outline_color='#FFFFFF', outline_width=1, bg=COLORS['bg'])
            no_label.pack(pady=50)
        else:
            for bank in banks:
                self.create_bank_manage_item(self.bank_list_frame, bank)
    
    def create_bank_manage_item(self, parent, bank):
        item_frame = tk.Frame(parent, bg=COLORS['white'], relief='solid', bd=1)
        item_frame.pack(fill='x', pady=5, padx=20)
        
        inner = tk.Frame(item_frame, bg=COLORS['white'])
        inner.pack(fill='x', padx=15, pady=10)
        
        info_text = f"{bank['name']}    作者：{bank['author']}    题目：{bank['count']}道"
        info_label = OutlinedLabel(inner, info_text, font_size=self.scaled(14), text_color=COLORS['text'], outline_color='#FFFFFF', outline_width=1, bg=COLORS['white'])
        info_label.pack(side='left')
        
        btn_frame = tk.Frame(inner, bg=COLORS['white'])
        btn_frame.pack(side='right')
        
        edit_btn = RoundedButton(btn_frame, "编辑", command=lambda b=bank: self.show_edit_bank_page(b), width=self.scaled(70), height=self.scaled(35), font_size=self.scaled(11))
        edit_btn.pack(side='left', padx=3)
        
        export_btn = RoundedButton(btn_frame, "导出", command=lambda b=bank: self.export_bank(b), width=self.scaled(70), height=self.scaled(35), font_size=self.scaled(11))
        export_btn.pack(side='left', padx=3)
        
        del_btn = RoundedButton(btn_frame, "删除", command=lambda b=bank: self.delete_bank(b), width=self.scaled(70), height=self.scaled(35), font_size=self.scaled(11), bg_color=COLORS['error'], hover_color='#FF3333')
        del_btn.pack(side='left', padx=3)
    
    def import_bank(self):
        filepath = filedialog.askopenfilename(filetypes=[("JSON文件", "*.json"), ("所有文件", "*.*")])
        if filepath:
            success, msg = QuestionBank.import_bank(filepath)
            if success:
                messagebox.showinfo("成功", msg)
                self.refresh_bank_list()
            else:
                messagebox.showerror("错误", msg)
    
    def export_bank(self, bank):
        dest_dir = filedialog.askdirectory(title="选择导出位置")
        if dest_dir:
            if QuestionBank.export_bank(bank['filename'], dest_dir):
                messagebox.showinfo("成功", "导出成功！")
            else:
                messagebox.showerror("错误", "导出失败")
    
    def delete_bank(self, bank):
        if messagebox.askyesno("确认", f"确定删除题库 '{bank['name']}' 吗？"):
            QuestionBank.delete_bank(bank['filename'])
            self.refresh_bank_list()
    
    def show_add_bank_page(self):
        self.clear_page()
        self.edit_questions = [{'image': '', 'question': '', 'answer': '', 'hint': ''}]
        self.edit_index = 0
        self.edit_bank_name = tk.StringVar(value="新题库")
        self.edit_author = tk.StringVar(value="")
        self.editing_bank = None
        self._show_bank_editor()
    
    def show_edit_bank_page(self, bank):
        self.clear_page()
        self.editing_bank = bank
        self.edit_questions = bank['questions'].copy()
        if not self.edit_questions:
            self.edit_questions = [{'image': '', 'question': '', 'answer': '', 'hint': ''}]
        self.edit_index = 0
        self.edit_bank_name = tk.StringVar(value=bank['name'])
        self.edit_author = tk.StringVar(value=bank.get('author', ''))
        self._show_bank_editor()
    
    def _show_bank_editor(self):
        self.current_page = 'edit_bank'
        
        main_frame = tk.Frame(self, bg=COLORS['bg'])
        main_frame.pack(fill='both', expand=True)
        
        self.create_background(main_frame)
        self.create_home_button(main_frame)
        
        # 顶部信息栏
        top_frame = tk.Frame(main_frame, bg=COLORS['bg'])
        top_frame.place(relx=0.5, rely=0.1, anchor='center')
        
        tk.Label(top_frame, text="题库名称:", font=('微软雅黑', self.scaled(12)), bg=COLORS['bg'], fg=COLORS['text']).pack(side='left')
        tk.Entry(top_frame, textvariable=self.edit_bank_name, font=('微软雅黑', self.scaled(12)), width=12).pack(side='left', padx=5)
        
        tk.Label(top_frame, text="作者:", font=('微软雅黑', self.scaled(12)), bg=COLORS['bg'], fg=COLORS['text']).pack(side='left', padx=(15,0))
        tk.Entry(top_frame, textvariable=self.edit_author, font=('微软雅黑', self.scaled(12)), width=10).pack(side='left', padx=5)
        
        self.question_info_label = OutlinedLabel(top_frame, f"第 1 / 1 题", font_size=self.scaled(14), text_color=COLORS['text'], outline_color='#FFFFFF', outline_width=1, bg=COLORS['bg'])
        self.question_info_label.pack(side='left', padx=30)
        
        # 编辑区域（使用相对布局）
        edit_frame = tk.Frame(main_frame, bg=COLORS['white'], relief='solid', bd=2)
        edit_frame.place(relx=0.5, rely=0.48, anchor='center', relwidth=0.92, relheight=0.55)
        
        # 左侧：图片上传区域（可点击的大按钮）
        left_frame = tk.Frame(edit_frame, bg=COLORS['white'])
        left_frame.place(relx=0.25, rely=0.5, anchor='center', relwidth=0.45, relheight=0.9)
        
        img_title = OutlinedLabel(left_frame, "题目图片 (点击上传)", font_size=self.scaled(14), text_color=COLORS['text'], outline_color='#FFFFFF', outline_width=1, bg=COLORS['white'])
        img_title.pack(pady=(5, 10))
        
        self.img_button = ImageButton(left_frame, text="点击此处上传图片", command=self.editor_upload_image, width=self.scaled(320), height=self.scaled(280))
        self.img_button.pack(expand=True, fill='both', padx=10, pady=5)
        
        # 右侧：问题设置
        right_frame = tk.Frame(edit_frame, bg=COLORS['white'])
        right_frame.place(relx=0.75, rely=0.5, anchor='center', relwidth=0.45, relheight=0.9)
        
        q_lbl = OutlinedLabel(right_frame, "问题:", font_size=self.scaled(14), text_color=COLORS['text'], outline_color='#FFFFFF', outline_width=1, bg=COLORS['white'])
        q_lbl.pack(anchor='w', pady=(10, 5), padx=10)
        self.question_entry = tk.Entry(right_frame, font=('微软雅黑', self.scaled(12)), width=30)
        self.question_entry.pack(pady=5, padx=10, fill='x')
        
        a_lbl = OutlinedLabel(right_frame, "答案:", font_size=self.scaled(14), text_color=COLORS['text'], outline_color='#FFFFFF', outline_width=1, bg=COLORS['white'])
        a_lbl.pack(anchor='w', pady=(15, 5), padx=10)
        self.answer_entry = tk.Entry(right_frame, font=('微软雅黑', self.scaled(12)), width=30)
        self.answer_entry.pack(pady=5, padx=10, fill='x')
        
        h_lbl = OutlinedLabel(right_frame, "提示:", font_size=self.scaled(14), text_color=COLORS['text'], outline_color='#FFFFFF', outline_width=1, bg=COLORS['white'])
        h_lbl.pack(anchor='w', pady=(15, 5), padx=10)
        self.hint_entry = tk.Entry(right_frame, font=('微软雅黑', self.scaled(12)), width=30)
        self.hint_entry.pack(pady=5, padx=10, fill='x')
        
        # 底部按钮
        btn_frame = tk.Frame(main_frame, bg=COLORS['bg'])
        btn_frame.place(relx=0.5, rely=0.9, anchor='center')
        
        RoundedButton(btn_frame, "上一题", command=self.editor_prev, width=self.scaled(100), height=self.scaled(45), font_size=self.scaled(12)).pack(side='left', padx=8)
        RoundedButton(btn_frame, "下一题", command=self.editor_next, width=self.scaled(100), height=self.scaled(45), font_size=self.scaled(12)).pack(side='left', padx=8)
        RoundedButton(btn_frame, "增加一题", command=self.editor_add, width=self.scaled(110), height=self.scaled(45), font_size=self.scaled(12)).pack(side='left', padx=8)
        RoundedButton(btn_frame, "清除本题", command=self.editor_clear, width=self.scaled(110), height=self.scaled(45), font_size=self.scaled(12)).pack(side='left', padx=8)
        RoundedButton(btn_frame, "保存题库", command=self.editor_save, width=self.scaled(130), height=self.scaled(45), font_size=self.scaled(14), bg_color=COLORS['success'], hover_color='#66BB6A').pack(side='left', padx=8)
        
        self.load_editor_question()
    
    def _show_edit_bank_page_internal(self):
        """内部方法：用于刷新编辑页面"""
        self._show_bank_editor()
    
    def load_editor_question(self):
        if 0 <= self.edit_index < len(self.edit_questions):
            q = self.edit_questions[self.edit_index]
            
            self.question_entry.delete(0, tk.END)
            self.question_entry.insert(0, q.get('question', ''))
            
            self.answer_entry.delete(0, tk.END)
            self.answer_entry.insert(0, q.get('answer', ''))
            
            self.hint_entry.delete(0, tk.END)
            self.hint_entry.insert(0, q.get('hint', ''))
            
            img_data = q.get('image', '')
            if img_data:
                try:
                    img = QuestionBank.base64_to_image(img_data)
                    if img:
                        self.img_button.set_image(img)
                    else:
                        self.img_button.clear_image()
                except:
                    self.img_button.clear_image()
            else:
                self.img_button.clear_image()
        
        total = len(self.edit_questions)
        valid = len([q for q in self.edit_questions if q.get('answer')])
        self.question_info_label.set_text(f"第 {self.edit_index + 1} / {total} 题 (有效: {valid})")
    
    def save_editor_question(self):
        if 0 <= self.edit_index < len(self.edit_questions):
            self.edit_questions[self.edit_index]['question'] = self.question_entry.get().strip()
            self.edit_questions[self.edit_index]['answer'] = self.answer_entry.get().strip()
            self.edit_questions[self.edit_index]['hint'] = self.hint_entry.get().strip()
    
    def editor_upload_image(self):
        filetypes = [("图片文件", "*.jpg *.jpeg *.png *.gif *.bmp"), ("所有文件", "*.*")]
        filepath = filedialog.askopenfilename(filetypes=filetypes)
        if filepath:
            base64_data = QuestionBank.image_to_base64(filepath)
            if base64_data:
                self.edit_questions[self.edit_index]['image'] = base64_data
                try:
                    img = Image.open(filepath)
                    self.img_button.set_image(img)
                except:
                    pass
    
    def editor_prev(self):
        if self.edit_index > 0:
            self.save_editor_question()
            self.edit_index -= 1
            self.load_editor_question()
    
    def editor_next(self):
        if self.edit_index < len(self.edit_questions) - 1:
            self.save_editor_question()
            self.edit_index += 1
            self.load_editor_question()
    
    def editor_add(self):
        self.save_editor_question()
        self.edit_questions.append({'image': '', 'question': '', 'answer': '', 'hint': ''})
        self.edit_index = len(self.edit_questions) - 1
        self.load_editor_question()
    
    def editor_clear(self):
        self.edit_questions[self.edit_index] = {'image': '', 'question': '', 'answer': '', 'hint': ''}
        self.load_editor_question()
    
    def editor_save(self):
        self.save_editor_question()
        valid_questions = [q for q in self.edit_questions if q.get('answer')]
        
        if not valid_questions:
            messagebox.showwarning("警告", "请至少添加一道有效题目（必须有答案）！")
            return
        
        bank_name = self.edit_bank_name.get().strip() or "新题库"
        author = self.edit_author.get().strip() or "未知"
        
        if self.editing_bank:
            QuestionBank.update_bank(self.editing_bank['filename'], bank_name, author, valid_questions)
        else:
            QuestionBank.save_bank(bank_name, author, valid_questions)
        
        messagebox.showinfo("成功", "保存成功！")
        self.show_manage_page()
    
    def show_select_bank_page(self):
        self.clear_page()
        self.current_page = 'select_bank'
        
        main_frame = tk.Frame(self, bg=COLORS['bg'])
        main_frame.pack(fill='both', expand=True)
        
        self.create_background(main_frame)
        self.create_home_button(main_frame)
        
        title = OutlinedLabel(main_frame, "选择题库", font_size=self.scaled(32), text_color=COLORS['text'], outline_color='#FFFFFF', outline_width=3, bg=COLORS['bg'])
        title.place(relx=0.5, rely=0.12, anchor='center')
        
        list_frame = tk.Frame(main_frame, bg=COLORS['bg'])
        list_frame.place(relx=0.5, rely=0.55, anchor='center', relwidth=0.9, relheight=0.7)
        
        canvas = tk.Canvas(list_frame, bg=COLORS['bg'], highlightthickness=0)
        scrollbar = ttk.Scrollbar(list_frame, orient='vertical', command=canvas.yview)
        scrollable_frame = tk.Frame(canvas, bg=COLORS['bg'])
        
        scrollable_frame.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=scrollable_frame, anchor='nw')
        canvas.configure(yscrollcommand=scrollbar.set)
        
        canvas.pack(side='left', fill='both', expand=True)
        scrollbar.pack(side='right', fill='y')
        
        banks = QuestionBank.get_all_banks()
        
        if not banks:
            no_label = OutlinedLabel(scrollable_frame, "暂无题库，请先添加", font_size=self.scaled(16), text_color=COLORS['text'], outline_color='#FFFFFF', outline_width=1, bg=COLORS['bg'])
            no_label.pack(pady=50)
        else:
            for bank in banks:
                self.create_select_bank_item(scrollable_frame, bank)
    
    def create_select_bank_item(self, parent, bank):
        item_frame = tk.Frame(parent, bg=COLORS['white'], relief='solid', bd=1)
        item_frame.pack(fill='x', pady=5, padx=20)
        
        inner = tk.Frame(item_frame, bg=COLORS['white'])
        inner.pack(fill='x', padx=15, pady=10)
        
        info_text = f"{bank['name']}    作者：{bank['author']}    题目：{bank['count']}道"
        info_label = OutlinedLabel(inner, info_text, font_size=self.scaled(14), text_color=COLORS['text'], outline_color='#FFFFFF', outline_width=1, bg=COLORS['white'])
        info_label.pack(side='left')
        
        select_btn = RoundedButton(inner, "开始", command=lambda b=bank: self.start_game(b), width=self.scaled(100), height=self.scaled(40), font_size=self.scaled(14), bg_color=COLORS['success'], hover_color='#66BB6A')
        select_btn.pack(side='right')
    
    def start_game(self, bank):
        self.game_bank = bank
        self.game_questions = bank['questions'].copy()
        self.game_author = bank.get('author', '未知')
        self.game_index = 0
        self.correct_count = 0
        self.attempt_count = 0
        self.gave_up_count = 0
        self.answered_current = False
        self.show_game_page()
    
    def show_game_page(self):
        self.clear_page()
        self.current_page = 'game'
        
        main_frame = tk.Frame(self, bg=COLORS['bg'])
        main_frame.pack(fill='both', expand=True)
        
        self.create_background(main_frame)
        self.create_home_button(main_frame)
        
        # 右上角信息
        info_frame = tk.Frame(main_frame, bg=COLORS['bg'])
        info_frame.place(relx=0.98, rely=0.03, anchor='ne')
        
        OutlinedLabel(info_frame, f"作者：{self.game_author}", font_size=self.scaled(12), text_color=COLORS['text'], outline_color='#FFFFFF', outline_width=1, bg=COLORS['bg']).pack(side='left', padx=10)
        OutlinedLabel(info_frame, f"第 {self.game_index + 1} / {len(self.game_questions)} 题", font_size=self.scaled(12), text_color=COLORS['text'], outline_color='#FFFFFF', outline_width=1, bg=COLORS['bg']).pack(side='left', padx=10)
        
        # 游戏区域
        game_frame = tk.Frame(main_frame, bg=COLORS['bg'])
        game_frame.place(relx=0.5, rely=0.55, anchor='center', relwidth=0.95, relheight=0.8)
        
        # 左侧：图片
        self.game_left_canvas = tk.Canvas(game_frame, bg=COLORS['white'], highlightthickness=3, highlightbackground='#FFFFFF')
        self.game_left_canvas.place(relx=0.25, rely=0.5, anchor='center', relwidth=0.45, relheight=0.9)
        
        self.game_img_label = tk.Label(self.game_left_canvas, text="图片加载中...", bg=COLORS['white'])
        self.game_img_label.place(relx=0.5, rely=0.5, anchor='center')
        
        current_q = self.game_questions[self.game_index]
        self.current_game_image_data = current_q.get('image', '')
        
        # 绑定画布尺寸变化事件，实现图片自适应
        self.game_left_canvas.bind('<Configure>', self._on_game_canvas_resize)
        
        # 延迟加载图片，等待画布渲染完成
        self.after(50, self._load_game_image)
        
        # 右侧
        right_canvas = tk.Canvas(game_frame, bg=COLORS['white'], highlightthickness=3, highlightbackground='#FFFFFF')
        right_canvas.place(relx=0.75, rely=0.5, anchor='center', relwidth=0.45, relheight=0.9)
        
        right_frame = tk.Frame(right_canvas, bg=COLORS['white'])
        right_frame.place(relx=0.5, rely=0.5, anchor='center')
        
        question_text = current_q.get('question', '猜猜这是什么？')
        OutlinedLabel(right_frame, f"{question_text}", font_size=self.scaled(16), text_color=COLORS['text'], outline_color='#FFFFFF', outline_width=1, bg=COLORS['white']).pack(pady=15)
        
        self.game_answer_entry = tk.Entry(right_frame, font=('微软雅黑', self.scaled(18)), width=15, justify='center')
        self.game_answer_entry.pack(pady=5)
        
        tk.Frame(right_frame, bg=COLORS['text'], height=3, width=self.scaled(220)).pack()
        
        self.result_label = OutlinedLabel(right_frame, "", font_size=self.scaled(14), text_color=COLORS['text'], outline_color='#FFFFFF', outline_width=1, bg=COLORS['white'])
        self.result_label.pack(pady=10)
        
        btn_frame = tk.Frame(right_frame, bg=COLORS['white'])
        btn_frame.pack(pady=15)
        
        RoundedButton(btn_frame, "回答", command=self.check_answer, width=self.scaled(90), height=self.scaled(42), font_size=self.scaled(13)).pack(side='left', padx=5)
        RoundedButton(btn_frame, "提示", command=self.show_hint, width=self.scaled(90), height=self.scaled(42), font_size=self.scaled(13)).pack(side='left', padx=5)
        RoundedButton(btn_frame, "放弃", command=self.give_up, width=self.scaled(90), height=self.scaled(42), font_size=self.scaled(13)).pack(side='left', padx=5)
        
        self.next_btn_frame = tk.Frame(right_frame, bg=COLORS['white'])
        RoundedButton(self.next_btn_frame, "下一题", command=self.next_question, width=self.scaled(140), height=self.scaled(48), font_size=self.scaled(15), bg_color=COLORS['success'], hover_color='#66BB6A').pack()
    
    def _load_game_image(self):
        """加载游戏图片并自适应画布大小"""
        if not self.current_game_image_data:
            self.game_img_label.config(text="无图片")
            return
        
        try:
            self.game_original_image = QuestionBank.base64_to_image(self.current_game_image_data)
            if self.game_original_image:
                self._resize_game_image()
            else:
                self.game_img_label.config(text="图片加载失败")
        except:
            self.game_img_label.config(text="图片加载失败")
    
    def _on_game_canvas_resize(self, event):
        """当画布大小变化时调整图片"""
        if hasattr(self, 'game_original_image') and self.game_original_image:
            self._resize_game_image()
    
    def _resize_game_image(self):
        """根据画布大小调整图片"""
        if not hasattr(self, 'game_original_image') or not self.game_original_image:
            return
        
        # 获取画布实际尺寸
        canvas_width = self.game_left_canvas.winfo_width()
        canvas_height = self.game_left_canvas.winfo_height()
        
        if canvas_width < 10 or canvas_height < 10:
            return
        
        # 留出边距
        max_width = canvas_width - 20
        max_height = canvas_height - 20
        
        # 复制原图并调整大小
        img = self.game_original_image.copy()
        
        # 计算缩放比例，保持纵横比
        img_width, img_height = img.size
        ratio_w = max_width / img_width
        ratio_h = max_height / img_height
        ratio = min(ratio_w, ratio_h)
        
        new_width = int(img_width * ratio)
        new_height = int(img_height * ratio)
        
        if new_width > 0 and new_height > 0:
            img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            photo = ImageTk.PhotoImage(img)
            self.game_img_label.config(image=photo, text="")
            self.game_img_label.image = photo
    
    def check_answer(self):
        if self.answered_current:
            return
        user_answer = self.game_answer_entry.get().strip()
        correct_answer = self.game_questions[self.game_index].get('answer', '')
        self.attempt_count += 1
        
        if user_answer == correct_answer:
            self.correct_count += 1
            self.answered_current = True
            self.sound_manager.play_sound('win')
            self.result_label.set_text("答对啦！太棒了！")
            self.next_btn_frame.pack(pady=10)
        else:
            self.sound_manager.play_sound('lose')
            self.result_label.set_text("答错啦~")
    
    def show_hint(self):
        hint = self.game_questions[self.game_index].get('hint', '')
        self.result_label.set_text(f"提示: {hint}" if hint else "这道题没有提示哦~")
    
    def give_up(self):
        if self.answered_current:
            return
        self.gave_up_count += 1
        self.answered_current = True
        correct_answer = self.game_questions[self.game_index].get('answer', '')
        self.result_label.set_text(f"正确答案是: {correct_answer}")
        self.next_btn_frame.pack(pady=10)
    
    def next_question(self):
        self.game_index += 1
        self.answered_current = False
        if self.game_index >= len(self.game_questions):
            self.show_game_complete()
        else:
            self.show_game_page()
    
    def show_game_complete(self):
        self.sound_manager.play_sound('clear')
        self.clear_page()
        self.current_page = 'complete'
        
        main_frame = tk.Frame(self, bg=COLORS['bg'])
        main_frame.pack(fill='both', expand=True)
        
        self.create_background(main_frame)
        
        content = tk.Frame(main_frame, bg=COLORS['bg'])
        content.place(relx=0.5, rely=0.5, anchor='center')
        
        OutlinedLabel(content, "恭喜通关！", font_size=self.scaled(40), text_color=COLORS['success'], outline_color='#FFFFFF', outline_width=3, bg=COLORS['bg']).pack(pady=(0, 20))
        OutlinedLabel(content, "- * - * - * -", font_size=self.scaled(24), text_color=COLORS['accent'], outline_color='#FFFFFF', outline_width=2, bg=COLORS['bg']).pack(pady=15)
        
        total = self.attempt_count + self.gave_up_count
        accuracy = (self.correct_count / total * 100) if total > 0 else 0
        
        stats_frame = tk.Frame(content, bg=COLORS['white'], relief='solid', bd=2)
        stats_frame.pack(pady=20)
        
        inner = tk.Frame(stats_frame, bg=COLORS['white'])
        inner.pack(padx=40, pady=20)
        
        OutlinedLabel(inner, "游戏统计", font_size=self.scaled(18), text_color=COLORS['text'], outline_color='#FFFFFF', outline_width=1, bg=COLORS['white']).pack(pady=5)
        OutlinedLabel(inner, f"答对: {self.correct_count}", font_size=self.scaled(14), text_color=COLORS['success'], outline_color='#FFFFFF', outline_width=1, bg=COLORS['white']).pack(pady=3)
        OutlinedLabel(inner, f"答错/放弃: {total - self.correct_count}", font_size=self.scaled(14), text_color=COLORS['error'], outline_color='#FFFFFF', outline_width=1, bg=COLORS['white']).pack(pady=3)
        OutlinedLabel(inner, f"正确率: {accuracy:.1f}%", font_size=self.scaled(14), text_color=COLORS['text'], outline_color='#FFFFFF', outline_width=1, bg=COLORS['white']).pack(pady=3)
        
        RoundedButton(content, "返回主界面", command=self.show_main_page, width=self.scaled(200), height=self.scaled(60), font_size=self.scaled(18)).pack(pady=25)

if __name__ == '__main__':
    app = EOEGuessGame()
    app.mainloop()
