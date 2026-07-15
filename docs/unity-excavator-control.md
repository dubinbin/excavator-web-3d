# Unity 挖掘机模型提取与 C# 控制方案

本文档基于当前 Three.js/Ammo.js 项目整理，目标是把 `models/scavator/scavator.glb` 单独拿到 Unity 中，使用 C# 脚本控制行走、上车回转、动臂、斗杆、铲斗，以及后续通过事件/消息通信驱动。

## 1. 当前项目里的实现方式

当前项目没有使用骨骼动画控制挖掘机，而是把 GLB 里的网格节点拆成多个机械部件，然后用 Ammo.js 刚体、Hinge 约束和马达控制。

关键文件：

- `models/scavator/scavator.glb`：挖掘机主模型，GLB 内使用 `KHR_draco_mesh_compression` 压缩。
- `models/scavator/scavator.jpg`：车身材质贴图。
- `models/scavator/chain.jpg`：履带齿材质贴图。
- `objects.js`：加载 GLB，拆分部件，创建刚体和铰链。
- `index.js`：键盘事件映射到各个铰链马达。
- `animate.js`：液压杆朝向更新、履带齿循环动画。
- `events.js`：键盘/鼠标事件采集。

迁移到 Unity 时，核心思路不是照搬 JS，而是保留它的机械结构和控制意图：

1. 在 Unity 中导入 GLB/FBX。
2. 按部件创建父子层级或 ArticulationBody 铰链。
3. 用 C# 提供统一控制接口。
4. 用键盘、UI、WebSocket、MQTT、ROS、UDP 或自定义事件调用这些接口。

## 2. Unity 导入建议

### 2.1 需要提取的资源

至少复制这些文件：

```text
models/scavator/scavator.glb
models/scavator/scavator.jpg
models/scavator/chain.jpg
```

建议在 Unity 中放到：

```text
Assets/Models/Scavator/scavator.glb
Assets/Models/Scavator/scavator.jpg
Assets/Models/Scavator/chain.jpg
```

### 2.2 GLB 导入注意点

这个 GLB 使用了 Draco 压缩扩展：

```text
KHR_draco_mesh_compression
```

Unity 默认项目不一定能直接正确导入这种 GLB。推荐两种路线：

- 路线 A：用 Blender 打开 `scavator.glb`，检查模型层级和轴心，然后导出 FBX 或未压缩 GLB 给 Unity。
- 路线 B：Unity 中安装支持 GLB 和 Draco 的 glTF 导入方案，再直接导入 GLB。

更推荐路线 A，因为本项目的控制依赖“部件轴心”和“层级关系”。在 Blender 里可以提前修正 pivot、命名和层级，后面 C# 控制会稳定很多。

### 2.3 轴心必须检查

挖掘机控制是否自然，主要取决于这些部件的 pivot：

- 履带底盘：整体移动/转向中心。
- 上车驾驶室：绕 Y 轴旋转。
- 下动臂：绕连接驾驶室的横向轴旋转。
- 上臂/斗杆：绕与下动臂连接的横向轴旋转。
- 铲斗：绕斗杆末端横向轴旋转。

如果导入后 pivot 不在铰接点，需要在 Blender 中修正，或者在 Unity 里给每个部件外面包一层空 GameObject，把空物体放在正确铰接点，让网格作为子物体偏移。

## 3. 模型节点与 Unity 部件映射

GLB 中能看到的主要节点包括：

```text
cabin
cabin_hover
cabin_hover_ct
cabin_ct_1
cabin_ct_2
cabin_ct_3
cabin_ct_4
arm_inferior
arm_inferior_ct
arm_superior
arm_superior_ct
pa
pa_ct_3
pa_ct_4
pa_ct_5
pa_ct_6
pa_ct_7
pa_ct_8
wheel
chain_part
chain_pike
esteiras
eng_di_dir
eng_di_esq
eng_tr_dir
eng_tr_esq
lr_pistons
lr_pistons_h
tp_piston
tp_piston_h
sup_pist
sup_piston_head
sup_piston_head_base
```

Three.js 运行时因为一个 mesh 可能有多个 primitive，有些名字会变成类似：

```text
cabin_1 / cabin_2
arm_superior_1 / arm_superior_2
pa_1 / pa_2
```

Unity 导入后名称可能不同，所以不要只依赖代码里的 `_1`、`_2` 后缀。导入后要在 Inspector 中确认实际 GameObject 名称。

推荐在 Unity 中整理成下面这种结构：

```text
ScavatorRoot
  TrackBase
    cabin_hover
    wheels
    tracks_visual
  UpperBodyPivot
    cabin
    BoomPivot
      arm_inferior
      StickPivot
        arm_superior
        BucketPivot
          pa
  HydraulicVisuals
    lr_pistons
    lr_pistons_h
    tp_piston
    tp_piston_h
    sup_pist
    sup_piston_head
```

这里的 `TrackBase`、`UpperBodyPivot`、`BoomPivot`、`StickPivot`、`BucketPivot` 可以是 Unity 里自己创建的空物体，用来提供正确 pivot。

## 4. 当前 JS 控制关系

`objects.js` 中的关节关系可以映射成 Unity 的铰链：

| JS 关节 | 连接关系 | Unity 对应 | 角度范围参考 |
| --- | --- | --- | --- |
| `JOINTCABIN` | cabin 到 cabin_hover | 上车回转 | `-3.2 ~ 3.2` rad |
| `JOINTBASE` | cabin 到 arm_inferior | 下动臂 | `-0.9959 ~ 0.3406` rad |
| `JOINTSUPERIOR` | arm_inferior 到 arm_superior | 上臂/斗杆 | `-PI/2 ~ 0.4` rad |
| `JOINTSHOVEL` | arm_superior 到 pa | 铲斗 | `-1.6 ~ 1.0` rad |
| `JOINTWHEELS[0..7]` | cabin_hover 到 wheel | 履带/轮子驱动 | 无固定角度，持续转动 |

Unity 角度通常用 degree。换算参考：

```text
JOINTCABIN:     -183.3° ~ 183.3°
JOINTBASE:       -57.1° ~ 19.5°
JOINTSUPERIOR:   -90.0° ~ 22.9°
JOINTSHOVEL:     -91.7° ~ 57.3°
```

实际 Unity 中建议先用更保守的范围，再根据视觉效果调整：

```csharp
upperYaw:       -180f, 180f
boomPitch:       -55f, 20f
stickPitch:      -90f, 25f
bucketPitch:     -90f, 60f
```

## 5. 输入映射

当前项目的键盘控制在 `index.js`：

| 按键 | 当前 JS 行为 | Unity 建议命令 |
| --- | --- | --- |
| `A` | 上车左转，`JOINTCABIN` 速度 `0.3` | `RotateUpper(+1)` |
| `D` | 上车右转，`JOINTCABIN` 速度 `-0.3` | `RotateUpper(-1)` |
| `W` | 下动臂抬/收，`JOINTBASE` 速度 `0.1` | `MoveBoom(+1)` |
| `S` | 下动臂降/放，`JOINTBASE` 速度 `-0.1` | `MoveBoom(-1)` |
| `ArrowUp` | 斗杆方向 1，`JOINTSUPERIOR` 速度 `-0.3` | `MoveStick(+1/-1)`，按实际方向校正 |
| `ArrowDown` | 斗杆方向 2，`JOINTSUPERIOR` 速度 `0.3` | `MoveStick(-1/+1)` |
| `ArrowLeft` | 铲斗卷入，`JOINTSHOVEL` 速度 `-0.5` | `MoveBucket(+1/-1)` |
| `ArrowRight` | 铲斗外翻，`JOINTSHOVEL` 速度 `0.5` | `MoveBucket(-1/+1)` |
| `Space` | 前进，左右履带同向 | `Drive(+1, +1)` |
| `LeftAlt` | 后退，左右履带同向反转 | `Drive(-1, -1)` |
| `E` | 原地转向方向 1 | `Drive(+1, -1)` |
| `Q` | 原地转向方向 2 | `Drive(-1, +1)` |

按键抬起时，JS 会把对应马达速度设为 0。Unity 中也建议使用“输入状态”而不是一次性调用：

```text
KeyDown:  设置目标速度/方向
KeyUp:    该轴归零
Update:   每帧平滑更新角度或物理目标
```

## 6. Unity 控制实现路线

### 6.1 简化方案：Transform 直接控制

适合展示、数字孪生、外部信号驱动，不要求真实挖土碰撞。

优点：

- 实现快。
- 可控性强。
- 事件通信简单。

缺点：

- 不是真实物理机械。
- 铲斗和物体碰撞、履带摩擦需要另做。

核心做法：

- `TrackBase` 控制整车平移/转向。
- `UpperBodyPivot.localEulerAngles.y` 控制上车回转。
- `BoomPivot.localEulerAngles.x/z` 控制动臂。
- `StickPivot.localEulerAngles.x/z` 控制斗杆。
- `BucketPivot.localEulerAngles.x/z` 控制铲斗。

具体绕 X、Y 还是 Z，要根据 Unity 导入后的朝向确定。不要盲目套 JS 的轴，因为 Three.js 和 Unity 坐标、导入器坐标修正可能不同。

### 6.2 物理方案：ArticulationBody

适合仿真、真实机械关节、碰撞交互。

推荐用 Unity 的 `ArticulationBody`，每个机械段作为一个 articulation link：

```text
TrackBase ArticulationBody, Fixed/Base
  UpperBodyPivot, Revolute Joint
    BoomPivot, Revolute Joint
      StickPivot, Revolute Joint
        BucketPivot, Revolute Joint
```

每个关节设置：

- `jointType = RevoluteJoint`
- `anchorPosition` 对准铰接点
- `axis` 对准旋转轴
- `xDrive.lowerLimit / upperLimit`
- `xDrive.target` 或 `xDrive.targetVelocity`
- `xDrive.stiffness / damping / forceLimit`

如果只是想“收到命令后转到某个角度”，用 `target`。
如果想“按住按键持续运动，松开停止”，用 `targetVelocity` 或自己积分目标角度。

## 7. C# 脚本结构建议

建议拆成 4 个脚本：

```text
ScavatorController.cs       // 统一控制接口
ScavatorKeyboardInput.cs    // 键盘输入适配
ScavatorEventBus.cs         // 本地事件分发
ScavatorMessageReceiver.cs  // 外部通信适配，后续可替换为 WebSocket/UDP/MQTT/ROS
```

核心原则：

- `ScavatorController` 不关心命令来自哪里。
- 键盘、UI、网络消息都转换成同一个 `ScavatorCommand`。
- 控制器只暴露稳定接口，例如 `Drive()`、`SetJointVelocity()`、`SetJointTarget()`、`StopAll()`。

## 8. Transform 版控制器示例

下面是简化版，适合先把模型跑起来。

```csharp
using UnityEngine;

public enum ExcavatorJoint
{
    UpperYaw,
    Boom,
    Stick,
    Bucket
}

public class ScavatorController : MonoBehaviour
{
    [Header("Roots")]
    public Transform trackBase;
    public Transform upperBodyPivot;
    public Transform boomPivot;
    public Transform stickPivot;
    public Transform bucketPivot;

    [Header("Speeds")]
    public float driveSpeed = 2.0f;
    public float turnSpeed = 45.0f;
    public float upperYawSpeed = 35.0f;
    public float boomSpeed = 25.0f;
    public float stickSpeed = 30.0f;
    public float bucketSpeed = 45.0f;

    [Header("Limits")]
    public Vector2 upperYawLimit = new Vector2(-180f, 180f);
    public Vector2 boomLimit = new Vector2(-55f, 20f);
    public Vector2 stickLimit = new Vector2(-90f, 25f);
    public Vector2 bucketLimit = new Vector2(-90f, 60f);

    float leftTrack;
    float rightTrack;
    float upperYawInput;
    float boomInput;
    float stickInput;
    float bucketInput;

    float upperYaw;
    float boom;
    float stick;
    float bucket;

    void Update()
    {
        UpdateDrive();
        UpdateJoint(ref upperYaw, upperYawInput, upperYawSpeed, upperYawLimit, upperBodyPivot, Vector3.up);
        UpdateJoint(ref boom, boomInput, boomSpeed, boomLimit, boomPivot, Vector3.right);
        UpdateJoint(ref stick, stickInput, stickSpeed, stickLimit, stickPivot, Vector3.right);
        UpdateJoint(ref bucket, bucketInput, bucketSpeed, bucketLimit, bucketPivot, Vector3.right);
    }

    public void Drive(float left, float right)
    {
        leftTrack = Mathf.Clamp(left, -1f, 1f);
        rightTrack = Mathf.Clamp(right, -1f, 1f);
    }

    public void SetJointVelocity(ExcavatorJoint joint, float value)
    {
        value = Mathf.Clamp(value, -1f, 1f);

        switch (joint)
        {
            case ExcavatorJoint.UpperYaw:
                upperYawInput = value;
                break;
            case ExcavatorJoint.Boom:
                boomInput = value;
                break;
            case ExcavatorJoint.Stick:
                stickInput = value;
                break;
            case ExcavatorJoint.Bucket:
                bucketInput = value;
                break;
        }
    }

    public void StopAll()
    {
        Drive(0f, 0f);
        upperYawInput = 0f;
        boomInput = 0f;
        stickInput = 0f;
        bucketInput = 0f;
    }

    void UpdateDrive()
    {
        float forward = (leftTrack + rightTrack) * 0.5f;
        float rotate = (rightTrack - leftTrack) * 0.5f;

        trackBase.position += trackBase.forward * forward * driveSpeed * Time.deltaTime;
        trackBase.Rotate(Vector3.up, rotate * turnSpeed * Time.deltaTime, Space.World);
    }

    void UpdateJoint(
        ref float angle,
        float input,
        float speed,
        Vector2 limit,
        Transform pivot,
        Vector3 localAxis)
    {
        if (pivot == null) return;

        angle = Mathf.Clamp(angle + input * speed * Time.deltaTime, limit.x, limit.y);

        if (localAxis == Vector3.up)
            pivot.localRotation = Quaternion.Euler(0f, angle, 0f);
        else if (localAxis == Vector3.right)
            pivot.localRotation = Quaternion.Euler(angle, 0f, 0f);
        else
            pivot.localRotation = Quaternion.AngleAxis(angle, localAxis);
    }
}
```

注意：`Boom/Stick/Bucket` 示例里用了本地 X 轴，实际可能需要改成 `Vector3.forward` 或反向输入。这取决于 Unity 里 pivot 的朝向。

## 9. 键盘输入适配示例

```csharp
using UnityEngine;

public class ScavatorKeyboardInput : MonoBehaviour
{
    public ScavatorController controller;

    void Update()
    {
        float upper = 0f;
        float boom = 0f;
        float stick = 0f;
        float bucket = 0f;
        float leftTrack = 0f;
        float rightTrack = 0f;

        if (Input.GetKey(KeyCode.A)) upper += 1f;
        if (Input.GetKey(KeyCode.D)) upper -= 1f;

        if (Input.GetKey(KeyCode.W)) boom += 1f;
        if (Input.GetKey(KeyCode.S)) boom -= 1f;

        if (Input.GetKey(KeyCode.UpArrow)) stick -= 1f;
        if (Input.GetKey(KeyCode.DownArrow)) stick += 1f;

        if (Input.GetKey(KeyCode.LeftArrow)) bucket -= 1f;
        if (Input.GetKey(KeyCode.RightArrow)) bucket += 1f;

        if (Input.GetKey(KeyCode.Space))
        {
            leftTrack = 1f;
            rightTrack = 1f;
        }
        else if (Input.GetKey(KeyCode.LeftAlt))
        {
            leftTrack = -1f;
            rightTrack = -1f;
        }
        else if (Input.GetKey(KeyCode.E))
        {
            leftTrack = 1f;
            rightTrack = -1f;
        }
        else if (Input.GetKey(KeyCode.Q))
        {
            leftTrack = -1f;
            rightTrack = 1f;
        }

        controller.SetJointVelocity(ExcavatorJoint.UpperYaw, upper);
        controller.SetJointVelocity(ExcavatorJoint.Boom, boom);
        controller.SetJointVelocity(ExcavatorJoint.Stick, stick);
        controller.SetJointVelocity(ExcavatorJoint.Bucket, bucket);
        controller.Drive(leftTrack, rightTrack);
    }
}
```

## 10. 事件通信设计

建议所有外部控制都走统一命令对象，不要让网络层直接改 Transform。

### 10.1 命令格式

推荐 JSON：

```json
{
  "type": "joint_velocity",
  "joint": "boom",
  "value": 0.75
}
```

```json
{
  "type": "drive",
  "left": 1.0,
  "right": 1.0
}
```

```json
{
  "type": "stop_all"
}
```

### 10.2 命令类型

| type | 字段 | 说明 |
| --- | --- | --- |
| `drive` | `left`, `right` | 左右履带速度，范围 `-1 ~ 1` |
| `joint_velocity` | `joint`, `value` | 关节速度，范围 `-1 ~ 1` |
| `joint_target` | `joint`, `angle` | 关节目标角度，单位 degree |
| `stop_all` | 无 | 停止全部运动 |
| `reset_pose` | 可选 | 回到默认姿态 |

`joint` 推荐枚举：

```text
upperYaw
boom
stick
bucket
```

### 10.3 Unity 本地事件总线示例

```csharp
using System;
using UnityEngine;

[Serializable]
public class ScavatorCommand
{
    public string type;
    public string joint;
    public float value;
    public float angle;
    public float left;
    public float right;
}

public class ScavatorEventBus : MonoBehaviour
{
    public static event Action<ScavatorCommand> OnCommand;

    public static void Publish(ScavatorCommand command)
    {
        OnCommand?.Invoke(command);
    }
}
```

`ScavatorController` 订阅事件：

```csharp
void OnEnable()
{
    ScavatorEventBus.OnCommand += HandleCommand;
}

void OnDisable()
{
    ScavatorEventBus.OnCommand -= HandleCommand;
}

void HandleCommand(ScavatorCommand command)
{
    switch (command.type)
    {
        case "drive":
            Drive(command.left, command.right);
            break;
        case "joint_velocity":
            SetJointVelocity(ParseJoint(command.joint), command.value);
            break;
        case "stop_all":
            StopAll();
            break;
    }
}
```

### 10.4 外部通信层

后续可以任选一种通信方式，只要最终发布 `ScavatorCommand`：

- WebSocket：适合网页控制面板、数字孪生后台。
- UDP：适合低延迟局域网控制。
- MQTT：适合物联网/设备状态同步。
- ROS/ROS2 Bridge：适合机器人仿真、自动驾驶/规划系统。
- Unity UI Button/Slider：适合本地调试。

通信层只负责解析消息：

```text
外部消息 -> JSON 解析 -> ScavatorCommand -> ScavatorEventBus.Publish()
```

不要让通信层直接控制 `Transform` 或 `ArticulationBody`。

## 11. 履带与轮子表现

当前 JS 里履带分两部分：

1. `JOINTWHEELS[0..7]`：8 个轮子的铰链马达。
2. `chain_tooth_l0..79` / `chain_tooth_r0..79`：把 `chain_pike` 复制 160 个，沿曲线循环移动，做履带齿动画。

Unity 可以分三档实现：

### 方案 A：只移动整车

最快，适合初版控制验证。

- `Drive(left, right)` 控制整车位置和朝向。
- 履带网格不动。

### 方案 B：滚动贴图

适合视觉展示。

- 给履带材质设置纹理偏移。
- 前进时左右履带贴图同向滚动。
- 原地转向时左右履带反向滚动。

### 方案 C：履带齿实例沿曲线移动

最接近当前 JS。

- 用 `chain_pike` 做一个履带齿 prefab。
- 左右各实例化 80 个。
- 定义履带闭合路径点。
- 每帧根据 `leftTrack/rightTrack` 更新每个齿的位置和朝向。

初期建议先做方案 A 或 B，等机械臂控制稳定后再做 C。

## 12. 液压杆表现

当前 `animate.js` 中液压杆不是物理伸缩，而是每帧让两个杆件互相 `lookAt`：

- `tp_piston` 和 `tp_piston_h`
- `sup_pist` 和 `sup_piston_head`
- `lr_pistons` 和 `lr_pistons_h`

Unity 里也可以这么做：

```csharp
using UnityEngine;

public class LookAtPair : MonoBehaviour
{
    public Transform a;
    public Transform b;
    public Vector3 aEulerOffset;
    public Vector3 bEulerOffset;

    void LateUpdate()
    {
        if (a == null || b == null) return;

        a.LookAt(b.position);
        a.Rotate(aEulerOffset, Space.Self);

        b.LookAt(a.position);
        b.Rotate(bEulerOffset, Space.Self);
    }
}
```

不同杆件的模型朝向不同，`aEulerOffset/bEulerOffset` 需要在 Unity Inspector 里调。

如果想做更真实的液压缸，可以把缸体和活塞拆成两段，一段 `LookAt`，另一段根据距离改变 local scale 或 local position。

## 13. 推荐落地顺序

1. 先把 `scavator.glb` 导入 Unity，确认所有部件名称和材质。
2. 在 Blender 或 Unity 中建立正确 pivot 层级。
3. 写 `ScavatorController`，先用 Transform 控制上车、动臂、斗杆、铲斗。
4. 写 `ScavatorKeyboardInput`，复刻当前项目按键。
5. 加 `Drive(left, right)`，先实现整车平移和原地转向。
6. 加液压杆 `LookAt` 视觉更新。
7. 加履带贴图滚动或履带齿循环动画。
8. 引入 `ScavatorCommand` 和 `ScavatorEventBus`。
9. 最后接 WebSocket/UDP/MQTT/ROS 等外部通信。
10. 如果需要真实物理，再把 Transform 控制替换为 `ArticulationBody`。

## 14. 迁移时最容易踩坑的点

- GLB 有 Draco 压缩，Unity 导入器可能不支持。
- GLB 导入后节点名可能和 JS 里不完全一致。
- 控制效果主要取决于 pivot，pivot 不对时角度再对也会怪。
- Three.js 和 Unity 坐标系/轴向不完全一致，关节轴需要在 Unity 里实测。
- 当前 JS 的履带运动主要是视觉动画，不代表真实履带物理。
- 当前 JS 的液压杆是视觉 `lookAt`，不是液压约束。
- 先不要一开始就做完整物理仿真，建议先把控制链路和视觉运动跑通。

## 15. 最小可用版本定义

第一版 Unity 只要做到下面这些，就已经能支撑后续事件通信：

- 模型正确显示。
- `A/D` 控制上车回转。
- `W/S` 控制动臂。
- `Up/Down` 控制斗杆。
- `Left/Right` 控制铲斗。
- `Space/Alt/Q/E` 控制前后和原地转向。
- 所有动作都能通过 `ScavatorCommand` 触发。

等这个版本稳定后，再继续增强履带动画、液压杆伸缩、碰撞和真实物理。
