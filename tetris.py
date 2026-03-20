import pygame
import random
import sys

# ─── 常量配置 ────────────────────────────────────────────────────────────────
SCREEN_WIDTH  = 400
SCREEN_HEIGHT = 700
BLOCK_SIZE    = 30
COLS          = 10
ROWS          = 20
BOARD_LEFT    = 30
BOARD_TOP     = 60
BOARD_WIDTH   = COLS * BLOCK_SIZE
BOARD_HEIGHT  = ROWS * BLOCK_SIZE

FPS = 60

# 颜色表
BLACK      = (  0,   0,   0)
WHITE      = (255, 255, 255)
GRAY       = (128, 128, 128)
DARK_GRAY  = ( 40,  40,  40)
BG_COLOR   = ( 18,  18,  28)
BOARD_COLOR= ( 25,  25,  40)
BORDER_CLR = ( 80,  80, 120)

COLORS = [
    (  0, 240, 240),   # I  青色
    (240, 240,   0),   # O  黄色
    (160,   0, 240),   # T  紫色
    (  0, 240,   0),   # S  绿色
    (240,   0,   0),   # Z  红色
    (  0,   0, 240),   # J  蓝色
    (240, 160,   0),   # L  橙色
]

# 七种方块的旋转状态（以 4×4 矩阵索引表示）
SHAPES = [
    # I
    [
        [(1,0),(1,1),(1,2),(1,3)],
        [(0,2),(1,2),(2,2),(3,2)],
        [(2,0),(2,1),(2,2),(2,3)],
        [(0,1),(1,1),(2,1),(3,1)],
    ],
    # O
    [
        [(0,1),(0,2),(1,1),(1,2)],
    ],
    # T
    [
        [(0,1),(1,0),(1,1),(1,2)],
        [(0,1),(1,1),(1,2),(2,1)],
        [(1,0),(1,1),(1,2),(2,1)],
        [(0,1),(1,0),(1,1),(2,1)],
    ],
    # S
    [
        [(0,1),(0,2),(1,0),(1,1)],
        [(0,1),(1,1),(1,2),(2,2)],
        [(1,1),(1,2),(2,0),(2,1)],
        [(0,0),(1,0),(1,1),(2,1)],
    ],
    # Z
    [
        [(0,0),(0,1),(1,1),(1,2)],
        [(0,2),(1,1),(1,2),(2,1)],
        [(1,0),(1,1),(2,1),(2,2)],
        [(0,1),(1,0),(1,1),(2,0)],
    ],
    # J
    [
        [(0,0),(1,0),(1,1),(1,2)],
        [(0,1),(0,2),(1,1),(2,1)],
        [(1,0),(1,1),(1,2),(2,2)],
        [(0,1),(1,1),(2,0),(2,1)],
    ],
    # L
    [
        [(0,2),(1,0),(1,1),(1,2)],
        [(0,1),(1,1),(2,1),(2,2)],
        [(1,0),(1,1),(1,2),(2,0)],
        [(0,0),(0,1),(1,1),(2,1)],
    ],
]

# ─── 方块类 ───────────────────────────────────────────────────────────────────
class Piece:
    def __init__(self, shape_idx: int):
        self.shape_idx  = shape_idx
        self.rotations  = SHAPES[shape_idx]
        self.rot        = 0
        self.color      = COLORS[shape_idx]
        # 初始位置：水平居中，顶部
        self.row        = 0
        self.col        = COLS // 2 - 2

    @property
    def cells(self):
        """返回当前旋转状态下所有方块格的 (row, col) 列表（相对于棋盘坐标）。"""
        return [(self.row + dr, self.col + dc)
                for dr, dc in self.rotations[self.rot]]

    def rotated_cells(self, dr=0, dc=0, rot_delta=0):
        """预览旋转/移动后的格子（不改变自身状态）。"""
        new_rot = (self.rot + rot_delta) % len(self.rotations)
        return [(self.row + dr + r, self.col + dc + c)
                for r, c in self.rotations[new_rot]]


# ─── 游戏逻辑 ─────────────────────────────────────────────────────────────────
class Tetris:
    def __init__(self):
        self.board      = [[None] * COLS for _ in range(ROWS)]
        self.score      = 0
        self.level      = 1
        self.lines      = 0
        self.game_over  = False
        self.paused     = False
        self.bag        = []
        self.current    = self._next_piece()
        self.next_piece = self._next_piece()
        self.fall_speed = self._calc_speed()
        self.fall_timer = 0
        self.lock_delay = 500    # ms
        self.lock_timer = 0
        self.on_ground  = False

    # ── 内部工具 ─────────────────────────────────────────────────────────────
    def _refill_bag(self):
        self.bag = list(range(len(SHAPES)))
        random.shuffle(self.bag)

    def _next_piece(self) -> Piece:
        if not self.bag:
            self._refill_bag()
        return Piece(self.bag.pop())

    def _calc_speed(self) -> float:
        """返回每帧下落累积的毫秒数（越大下落越快）。"""
        return max(50, 800 - (self.level - 1) * 70)

    def _valid(self, cells) -> bool:
        for r, c in cells:
            if c < 0 or c >= COLS or r >= ROWS:
                return False
            if r >= 0 and self.board[r][c] is not None:
                return False
        return True

    def _lock_piece(self):
        for r, c in self.current.cells:
            if r < 0:
                self.game_over = True
                return
            self.board[r][c] = self.current.color
        self._clear_lines()
        self.current    = self.next_piece
        self.next_piece = self._next_piece()
        self.on_ground  = False
        self.lock_timer = 0
        if not self._valid(self.current.cells):
            self.game_over = True

    def _clear_lines(self):
        full = [r for r in range(ROWS) if all(self.board[r][c] is not None for c in range(COLS))]
        for r in full:
            del self.board[r]
            self.board.insert(0, [None] * COLS)
        n = len(full)
        if n:
            base  = [0, 100, 300, 500, 800]
            self.score += base[n] * self.level
            self.lines += n
            self.level  = self.lines // 10 + 1
            self.fall_speed = self._calc_speed()

    # ── 玩家操作 ──────────────────────────────────────────────────────────────
    def move(self, dr: int, dc: int):
        new_cells = self.current.rotated_cells(dr=dr, dc=dc)
        if self._valid(new_cells):
            self.current.row += dr
            self.current.col += dc
            if dr > 0:
                self.on_ground = False
            return True
        return False

    def rotate(self, delta: int = 1):
        new_cells = self.current.rotated_cells(rot_delta=delta)
        # 基础旋转
        if self._valid(new_cells):
            self.current.rot = (self.current.rot + delta) % len(self.current.rotations)
            return
        # 简单墙踢：尝试左右各移一格
        for dc in (1, -1, 2, -2):
            kick_cells = self.current.rotated_cells(dc=dc, rot_delta=delta)
            if self._valid(kick_cells):
                self.current.col += dc
                self.current.rot = (self.current.rot + delta) % len(self.current.rotations)
                return

    def hard_drop(self):
        while self.move(1, 0):
            self.score += 2
        self._lock_piece()

    def _ghost_row(self) -> int:
        """计算幽灵方块（落点预览）的行偏移量。"""
        dr = 0
        while self._valid(self.current.rotated_cells(dr=dr + 1)):
            dr += 1
        return dr

    # ── 每帧更新 ──────────────────────────────────────────────────────────────
    def update(self, dt: int):
        if self.game_over or self.paused:
            return

        self.fall_timer += dt

        # 检测是否贴地
        touching = not self._valid(self.current.rotated_cells(dr=1))

        if touching:
            if not self.on_ground:
                self.on_ground  = True
                self.lock_timer = 0
            else:
                self.lock_timer += dt
                if self.lock_timer >= self.lock_delay:
                    self._lock_piece()
                    self.fall_timer = 0
        else:
            self.on_ground  = False
            self.lock_timer = 0
            if self.fall_timer >= self.fall_speed:
                self.fall_timer = 0
                self.move(1, 0)


# ─── 绘制工具 ─────────────────────────────────────────────────────────────────
def draw_block(surface, color, row, col, alpha=255):
    x = BOARD_LEFT + col * BLOCK_SIZE
    y = BOARD_TOP  + row * BLOCK_SIZE
    rect = pygame.Rect(x + 1, y + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2)

    block_surf = pygame.Surface((BLOCK_SIZE - 2, BLOCK_SIZE - 2), pygame.SRCALPHA)
    r, g, b = color
    block_surf.fill((r, g, b, alpha))

    # 高光
    pygame.draw.line(block_surf, (min(r+80,255), min(g+80,255), min(b+80,255)),
                     (0, 0), (BLOCK_SIZE - 3, 0), 2)
    pygame.draw.line(block_surf, (min(r+80,255), min(g+80,255), min(b+80,255)),
                     (0, 0), (0, BLOCK_SIZE - 3), 2)
    # 阴影
    pygame.draw.line(block_surf, (max(r-60,0), max(g-60,0), max(b-60,0)),
                     (BLOCK_SIZE - 3, 1), (BLOCK_SIZE - 3, BLOCK_SIZE - 3), 2)
    pygame.draw.line(block_surf, (max(r-60,0), max(g-60,0), max(b-60,0)),
                     (1, BLOCK_SIZE - 3), (BLOCK_SIZE - 3, BLOCK_SIZE - 3), 2)

    surface.blit(block_surf, rect.topleft)


def draw_board(surface, game: Tetris, font_small, font_big):
    surface.fill(BG_COLOR)

    # 棋盘背景
    board_rect = pygame.Rect(BOARD_LEFT - 2, BOARD_TOP - 2,
                              BOARD_WIDTH + 4, BOARD_HEIGHT + 4)
    pygame.draw.rect(surface, BOARD_COLOR,
                     (BOARD_LEFT, BOARD_TOP, BOARD_WIDTH, BOARD_HEIGHT))
    pygame.draw.rect(surface, BORDER_CLR, board_rect, 2, border_radius=4)

    # 网格线
    for r in range(ROWS + 1):
        y = BOARD_TOP + r * BLOCK_SIZE
        pygame.draw.line(surface, DARK_GRAY,
                         (BOARD_LEFT, y), (BOARD_LEFT + BOARD_WIDTH, y))
    for c in range(COLS + 1):
        x = BOARD_LEFT + c * BLOCK_SIZE
        pygame.draw.line(surface, DARK_GRAY,
                         (x, BOARD_TOP), (x, BOARD_TOP + BOARD_HEIGHT))

    # 已锁定方块
    for r in range(ROWS):
        for c in range(COLS):
            if game.board[r][c]:
                draw_block(surface, game.board[r][c], r, c)

    # 幽灵方块
    ghost_dr = game._ghost_row()
    if ghost_dr > 0:
        for r, c in game.current.rotated_cells(dr=ghost_dr):
            if 0 <= r < ROWS and 0 <= c < COLS:
                draw_block(surface, game.current.color, r, c, alpha=55)

    # 当前方块
    for r, c in game.current.cells:
        if r >= 0:
            draw_block(surface, game.current.color, r, c)

    # ── 右侧面板 ──────────────────────────────────────────────────────────────
    panel_x = BOARD_LEFT + BOARD_WIDTH + 20
    panel_y = BOARD_TOP

    def label(text, y_off, color=WHITE, big=False):
        f = font_big if big else font_small
        surf = f.render(text, True, color)
        surface.blit(surf, (panel_x, panel_y + y_off))

    label("NEXT",    0,  GRAY)
    # 绘制下一个方块（在 4×4 格子内居中）
    np_cells = game.next_piece.rotations[0]
    min_r = min(r for r, c in np_cells)
    min_c = min(c for r, c in np_cells)
    for dr, dc in np_cells:
        pr = dr - min_r
        pc = dc - min_c
        nx = panel_x + pc * BLOCK_SIZE
        ny = panel_y + 25 + pr * BLOCK_SIZE
        rect = pygame.Rect(nx + 1, ny + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2)
        pygame.draw.rect(surface, game.next_piece.color, rect, border_radius=3)

    label("SCORE",   160, GRAY)
    label(str(game.score), 180, WHITE, big=True)

    label("LEVEL",   240, GRAY)
    label(str(game.level), 260, WHITE, big=True)

    label("LINES",   320, GRAY)
    label(str(game.lines), 340, WHITE, big=True)

    label("──────",  395, DARK_GRAY)
    label("↑  旋转",  415, GRAY)
    label("← →  移动", 435, GRAY)
    label("↓  加速",  455, GRAY)
    label("空格 硬降", 475, GRAY)
    label("P  暂停",  495, GRAY)
    label("R  重开",  515, GRAY)

    # 暂停 / 结束覆盖层
    if game.paused and not game.game_over:
        _overlay(surface, font_big, "暂 停", "按 P 继续")
    if game.game_over:
        _overlay(surface, font_big, "游戏结束", f"得分: {game.score}  按 R 重开")


def _overlay(surface, font, title: str, subtitle: str):
    overlay = pygame.Surface((BOARD_WIDTH, BOARD_HEIGHT), pygame.SRCALPHA)
    overlay.fill((0, 0, 0, 160))
    surface.blit(overlay, (BOARD_LEFT, BOARD_TOP))

    t1 = font.render(title,    True, WHITE)
    t2 = font.render(subtitle, True, GRAY)
    cx = BOARD_LEFT + BOARD_WIDTH  // 2
    cy = BOARD_TOP  + BOARD_HEIGHT // 2
    surface.blit(t1, t1.get_rect(center=(cx, cy - 24)))
    surface.blit(t2, t2.get_rect(center=(cx, cy + 16)))


# ─── 主程序 ───────────────────────────────────────────────────────────────────
def main():
    pygame.init()
    screen  = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
    pygame.display.set_caption("俄罗斯方块")
    clock   = pygame.time.Clock()

    # 字体（优先使用系统中文字体）
    try:
        font_small = pygame.font.SysFont("PingFang SC", 18)
        font_big   = pygame.font.SysFont("PingFang SC", 26, bold=True)
    except Exception:
        font_small = pygame.font.SysFont(None, 20)
        font_big   = pygame.font.SysFont(None, 28, bold=True)

    game = Tetris()

    while True:
        dt = clock.tick(FPS)

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()

            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_r:
                    game = Tetris()
                    continue

                if game.game_over:
                    continue

                if event.key == pygame.K_p:
                    game.paused = not game.paused
                    continue

                if game.paused:
                    continue

                if event.key == pygame.K_LEFT:
                    game.move(0, -1)
                elif event.key == pygame.K_RIGHT:
                    game.move(0, 1)
                elif event.key == pygame.K_UP:
                    game.rotate(1)
                elif event.key == pygame.K_DOWN:
                    game.move(1, 0)
                    game.score += 1
                elif event.key == pygame.K_SPACE:
                    game.hard_drop()
                elif event.key == pygame.K_z:
                    game.rotate(-1)

        # 长按加速
        keys = pygame.key.get_pressed()
        if keys[pygame.K_DOWN] and not game.paused and not game.game_over:
            game.fall_timer += dt * 8

        game.update(dt)
        draw_board(screen, game, font_small, font_big)
        pygame.display.flip()


if __name__ == "__main__":
    main()
