import requests
import time
from datetime import datetime
import threading
from app.core.config import settings

class BaiduScheduler:
    def __init__(self, interval: int = 300):
        self.interval = interval
        self.running = False

    def _access_baidu(self):
        url = "https://www.baidu.com"
        try:
            response = requests.get(url, timeout=10)
            status = "成功" if response.status_code == 200 else f"失败 (状态码: {response.status_code})"
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 访问百度 {status}")
        except Exception as e:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 访问百度 失败: {str(e)}")

    def start(self):
        if self.running:
            return
        self.running = True
        print(f"✅ 百度访问任务已启动（每 {self.interval//60} 分钟执行一次）")
        
        def task():
            while self.running:
                self._access_baidu()
                time.sleep(self.interval)
        
        threading.Thread(target=task, daemon=True).start()

scheduler = BaiduScheduler(interval=settings.BAIDU_ACCESS_INTERVAL or 300)