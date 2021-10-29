---
title: Matplotlib绘制3D折线图
date: 2021-10-20 20:08:20
tags:
 - Matplotlib
categories:
 - Learning
---
## 绘图相关设置

导入相关库

```python
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection	# 用于绘制三维图像
```



首先对绘制的图像进行一下设置，绘制数据如果有变化，在这里更改相应的设置即可

```python
# 文件名
csv_filename = "test.csv"
# 字体设置
FONTS = "Times New Roman"
# 折线图颜色， 每个切面对应一个颜色，如果只有一个值则所有切面均使用同一个颜色
COLOR = ['darkviolet', 'purple', 'green', 'yellow', 'red']

CONFIG = {"alpha":[0.8],                        # 折线图透明度
          "facecolor": COLOR,                   # 折线图颜色
          "edgecolors": COLOR,                  # 折线图边缘线条颜色
          "linewidths":2.0                      # 折线图边缘线条粗细
        }
# 是否显示网格
GRID = False
##################### X 轴 #####################
X_label = "Raman Shift(cm$^{-1}$)"              # X轴标签
X_range = range(0, 2001, 500)                   # X轴坐标范围, range(最小值，最大值(不包含)，间距)
##################### Y 轴 #####################
Y_label = "Bacterial Concentration(CFU)"        # Y轴标签
Y_ticklabels = ["100", "50" ,"10" ,"1", "0"]    # Y刻度标签
##################### Z 轴 #####################
Z_laebl = "Intensity(a.u.)"                     # Z轴标签
Z_range = (0, 20000)                            # Z轴范围（最小值， 最大值）
```

## 绘制图像

新建一个类，读取指定文件并进行绘制。文件中第一列为X轴，其余列分别为不同组的Y值

```python
class WaterFall:
    def __init__(self, filename:str,) -> None:
        self.raw_data = pd.read_csv(filename, sep="\t").values
        self.data_process()	# 处理数据
```

预处理数据，转换为三维折线图所需要的格式

```python
    def data_process(self) -> None: 
        # 使用np.pad()对数据的第一行和最后一行填充0
        # np.pad(array, [(第1维度填充宽度(行)), (第2维度填充宽度(列))])
        data = np.pad(self.raw_data, [(1,1), (0,0)])
        # 数据开头添加一行[min(x), 0, 0, ...]
        data[0, 0] = self.raw_data[0, 0]
        # 数据结尾添加一行[max(x), 0, 0, ...]
        data[-1, 0] = self.raw_data[-1, 0]
        self.data = []
        for i in range(1, data.shape[1]):
            self.data.append(data[:,[0, i]])
        
        # 绘制三维折线图需要的数据格式为
        # [[X, Y1], [X, Y2].....]
        # 其中每组数据的Y开头和结尾都必须是0，否则会画不出图像
        # 因为需要提前在数据开头和结尾添加一行数据0，x对应的为X的最小值和最大值
		
```

绘制曲线

```python
    
    def show(self):
        # 选择绘制模式为3D, 设置图片大小（英寸）和分辨率（dot per inch)
        canvas = plt.figure(figsize=(12,8), dpi=150).add_subplot(projection='3d')					
        # 设置X, Y, Z轴的比例
        canvas.set_box_aspect(aspect = (1,1.3,0.8))							
        canvas.add_collection3d(PolyCollection(self.data[::-1], **CONFIG),	# 由于数据为逆序，这里将数据倒置
                                # Z轴（X，Y之外的第三维度，非实际Z轴）为需要绘制折线图的数量
                                zs = range(len(self.data)),	
                                # 设置Z轴显示Y数据
                                zdir = 'y')		
        # 设置字体
        plt.rcParams["font.sans-serif"] = FONTS	
        # 设置坐标轴标题
        canvas.set_xlabel(X_label)						
        canvas.set_ylabel(Y_label)
        canvas.set_zlabel(Z_laebl, labelpad=-15)
        # 设置坐标轴显示范围
        canvas.set_ylim(-0.5, len(self.data) - 0.5)
        canvas.set_zlim(*Z_range)
        # 设置坐标轴刻度
        canvas.set_xticks(X_range)
        # 设置Y轴刻度标签
        canvas.set_yticklabels(["", *Y_ticklabels])
        # 取消Z轴刻度显示
        canvas.set_zticks([])
        canvas.grid(GRID)
        # 设置三个轴平面的背景颜色为灰色，颜色用(R,G,B,Alpha)表示，取值0~1
        canvas.w_xaxis.set_pane_color((0,0,0,0.1))
        canvas.w_yaxis.set_pane_color((0,0,0,0.1))
        canvas.w_zaxis.set_pane_color((0,0,0,0.1))
        plt.show()
```

配置完成后运行绘制即可看到成品

```python
if __name__ == '__main__':
    wf = WaterFall(csv_filename)
    wf.show()
```
![result](result.png)

## Matploblib显示所有可用颜色的方法

使用官方提供的[示例](https://matplotlib.org/stable/gallery/color/named_colors.html#sphx-glr-gallery-color-named-colors-py)可以可视化看到plt中所有支持的颜色

```python
from matplotlib.patches import Rectangle
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors


def plot_colortable(colors, title, sort_colors=True, emptycols=0):

    cell_width = 212
    cell_height = 22
    swatch_width = 48
    margin = 12
    topmargin = 40

    # Sort colors by hue, saturation, value and name.
    if sort_colors is True:
        by_hsv = sorted((tuple(mcolors.rgb_to_hsv(mcolors.to_rgb(color))),
                         name)
                        for name, color in colors.items())
        names = [name for hsv, name in by_hsv]
    else:
        names = list(colors)

    n = len(names)
    ncols = 4 - emptycols
    nrows = n // ncols + int(n % ncols > 0)

    width = cell_width * 4 + 2 * margin
    height = cell_height * nrows + margin + topmargin
    dpi = 72

    fig, ax = plt.subplots(figsize=(width / dpi, height / dpi), dpi=dpi)
    fig.subplots_adjust(margin/width, margin/height,
                        (width-margin)/width, (height-topmargin)/height)
    ax.set_xlim(0, cell_width * 4)
    ax.set_ylim(cell_height * (nrows-0.5), -cell_height/2.)
    ax.yaxis.set_visible(False)
    ax.xaxis.set_visible(False)
    ax.set_axis_off()
    ax.set_title(title, fontsize=24, loc="left", pad=10)

    for i, name in enumerate(names):
        row = i % nrows
        col = i // nrows
        y = row * cell_height

        swatch_start_x = cell_width * col
        text_pos_x = cell_width * col + swatch_width + 7

        ax.text(text_pos_x, y, name, fontsize=14,
                horizontalalignment='left',
                verticalalignment='center')

        ax.add_patch(
            Rectangle(xy=(swatch_start_x, y-9), width=swatch_width,
                      height=18, facecolor=colors[name], edgecolor='0.7')
        )

    return fig

plot_colortable(mcolors.BASE_COLORS, "Base Colors",
                sort_colors=False, emptycols=1)
plot_colortable(mcolors.CSS4_COLORS, "CSS Colors")

# Optionally plot the XKCD colors (Caution: will produce large figure)
#xkcd_fig = plot_colortable(mcolors.XKCD_COLORS, "XKCD Colors")
#xkcd_fig.savefig("XKCD_Colors.png")

plt.show()
```

### 基础颜色

![base_color](base.png)

### CSS颜色

![CSS_Color](CSScolor.png)