# Spring AI + DeepSeek 实战：从零打造企业级 AI 对话应用

<p align="center">
  <img src="https://img.shields.io/badge/Spring%20AI-1.0.0--M4-green?style=flat-square&logo=spring" alt="Spring AI">
  <img src="https://img.shields.io/badge/DeepSeek-chat-blue?style=flat-square" alt="DeepSeek">
  <img src="https://img.shields.io/badge/Java-17-orange?style=flat-square&logo=openjdk" alt="Java">
  <img src="https://img.shields.io/badge/Spring%20Boot-3.3.0-brightgreen?style=flat-square&logo=spring" alt="Spring Boot">
</p>

> **"Java 也能玩转 AI 大模型！"** —— 这不再是梦想，通过 Spring AI 框架，Java 开发者可以优雅地集成各类 AI 模型。

---

## 📖 文章导读

作为一名深耕 Java 后端多年的工程师，我曾认为 AI 大模型的世界是属于 Python 的天下。然而，当 Spring AI 框架横空出世后，一切都变了——**我也能开发自己的 AI 应用了！**

本文将手把手教你如何利用 **Spring AI + DeepSeek** 从零构建一个企业级 AI 对话应用，核心技术同样适用于 OpenAI、Anthropic、Azure OpenAI 等主流 AI 服务商。

### 🔥 亮点速览

| 特性 | 说明 |
|------|------|
| 🌊 **流式输出** | 打字机效果，实时展示 AI 生成过程 |
| 💬 **多轮对话** | 支持上下文记忆，理解连续对话 |
| 🎨 **优雅界面** | 响应式设计，亮/暗主题切换 |
| 🔧 **企业级架构** | Spring AI 驱动，易于扩展 |
| 🚀 **一键部署** | 标准 Spring Boot 项目，jar 包即可运行 |

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        浏览器 (Client)                           │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  chat.html   │  │   app.js     │  │   markdown.js + css    │ │
│  │  (Thymeleaf) │  │  (流式通信)  │  │   (样式与渲染)         │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP / SSE
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Spring Boot 3.3.0 (Port 8080)                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                      ChatController                        ││
│  │   POST /api/chat/stream  ← 流式对话                         ││
│  │   POST /api/chat/send   ← 同步对话                         ││
│  │   DELETE /api/chat/clear ← 清空历史                         ││
│  │   GET /api/chat/history ← 获取历史                         ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                     Spring AI 1.0.0-M4                      ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  ││
│  │  │ ChatClient │  │  ChatModel  │  │ SimpleLoggerAdvisor │  ││
│  │  │  (核心API)  │  │  (模型抽象)  │  │   (日志记录)        │  ││
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DeepSeek API (兼容 OpenAI)                    │
│              https://api.deepseek.com/v1/chat/completions       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 💡 为什么选择 Spring AI？

### 1. 统一的 API 抽象

Spring AI 提供了一套 **统一的编程模型**，不管你接入的是 OpenAI、DeepSeek 还是其他厂商，代码风格高度一致：

```java
// 注入 ChatModel（由 Spring AI 自动配置）
public ChatController(ChatModel chatModel) {
    this.chatClient = ChatClient.builder(chatModel)
            .defaultAdvisors(new SimpleLoggerAdvisor())
            .build();
}

// 流式对话
return chatClient.prompt()
    .user(contextPrompt)
    .stream()
    .content();

// 同步对话
String response = chatClient.prompt()
    .user(message)
    .call()
    .content();
```

### 2. 强大的生态集成

```xml
<!-- 接入 OpenAI/DeepSeek（兼容协议） -->
<dependency>
    <groupId>org.springframework.ai</groupId>
    <artifactId>spring-ai-openai-spring-boot-starter</artifactId>
</dependency>

<!-- 接入 Anthropic Claude -->
<dependency>
    <groupId>org.springframework.ai</groupId>
    <artifactId>spring-ai-anthropic-spring-boot-starter</artifactId>
</dependency>

<!-- 接入阿里通义千问 -->
<dependency>
    <groupId>org.springframework.ai</groupId>
    <artifactId>spring-ai-alibaba-spring-boot-starter</artifactId>
</dependency>

<!-- 接入 Ollama（本地部署） -->
<dependency>
    <groupId>org.springframework.ai</groupId>
    <artifactId>spring-ai-ollama-spring-boot-starter</artifactId>
</dependency>
```

### 3. 企业级特性开箱即用

| 特性 | 说明 |
|------|------|
| 🔄 **重试机制** | 内置指数退避重试策略 |
| 📊 **监控指标** | 与 Micrometer/Spring Boot Actuator 集成 |
| 🛡️ **安全防护** | 支持 API Key 管理、速率限制 |
| 📝 **日志追踪** | 请求/响应完整记录 |
| 🔌 **函数调用** | Function Calling / Tool Use 支持 |

---

## 🚀 快速开始

### 环境要求

- JDK 17+
- Maven 3.6+

### 1. 克隆项目

```bash
git clone https://github.com/xl-echo/springAiDemo.git
cd springAiDemo
```

### 2. 配置 API Key

编辑 `src/main/resources/application.properties`：

```properties
# DeepSeek API 配置
spring.ai.openai.api-key=your-api-key-here
spring.ai.openai.base-url=https://api.deepseek.com
spring.ai.openai.chat.options.model=deepseek-chat
spring.ai.openai.chat.options.temperature=0.7
```

> 💡 **提示**: DeepSeek API Key 可在 [DeepSeek 开放平台](https://platform.deepseek.com/) 免费获取，新用户赠送初始额度！

### 3. 启动应用

```bash
# 编译打包
mvn clean package -DskipTests

# 运行
java -jar target/deepseek-chat-1.0.0.jar
```

### 4. 访问应用

打开浏览器访问：**http://localhost:8080**

---

## 🔥 核心代码解读

### ChatController.java - 流式对话核心实现

```java
@PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public Flux<String> chatStream(@RequestBody Map<String, String> request) {
    String userMessage = request.get("message");

    // 1. 保存用户消息到历史
    synchronized (messageHistory) {
        messageHistory.add(new ChatMessage("user", userMessage));
    }

    // 2. 构建带上下文的提示词
    String contextPrompt = buildContextPrompt(userMessage);

    // 3. 调用 AI 并返回流式响应
    return chatClient.prompt()
        .user(contextPrompt)
        .stream()
        .content()
        .doOnNext(chunk -> {
            // 实时推送每个 token
            log.info("【AI chunk】: {}", chunk);
        })
        .doOnComplete(() -> {
            // 流结束后保存完整回复
            log.info("【AI 回复完成】");
        })
        .map(chunk -> "TEXT:" + chunk)  // 前缀标记
        .concatWith(Flux.just("DONE"));  // 结束信号
}
```

### 切换不同 AI 服务商

**接入 OpenAI GPT-4：**
```properties
spring.ai.openai.api-key=sk-xxxx
spring.ai.openai.base-url=https://api.openai.com
spring.ai.openai.chat.options.model=gpt-4-turbo
```

**接入 Claude：**
```xml
<dependency>
    <groupId>org.springframework.ai</groupId>
    <artifactId>spring-ai-anthropic-spring-boot-starter</artifactId>
</dependency>
```
```properties
spring.ai.anthropic.api-key=sk-ant-xxxx
spring.ai.anthropic.chat.options.model=claude-3-opus-20240229
```

**接入本地 Ollama：**
```xml
<dependency>
    <groupId>org.springframework.ai</groupId>
    <artifactId>spring-ai-ollama-spring-boot-starter</artifactId>
</dependency>
```
```properties
spring.ai.ollama.base-url=http://localhost:11434
spring.ai.ollama.chat.options.model=llama3
```

---

## 🎯 开发属于自己的 AI 中转站

> **"以前总觉得 AI 中转站是大神的专属，现在我自己也能做了！"**

基于本项目，你可以轻松扩展出企业级 AI 中转站：

### 🚀 扩展方向

| 扩展功能 | 说明 |
|---------|------|
| 💰 **多渠道管理** | 同时接入 OpenAI、DeepSeek、Claude 等多渠道，智能路由 |
| 📊 **用量统计** | 记录每个用户、每个渠道的 API 调用量 |
| 💳 **余额管理** | 支持余额充值、套餐购买 |
| 🔄 **智能路由** | 根据用户余额、模型能力自动选择最优渠道 |
| 📝 **对话管理** | 持久化存储、历史记录导出 |
| 🔌 **插件系统** | 函数调用、工具扩展 |

### 💡 中转站核心架构

```
                    ┌─────────────────┐
                    │   用户请求入口    │
                    │  /api/chat/send │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   负载均衡器     │
                    │  (策略路由)      │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼───────┐    ┌───────▼───────┐    ┌───────▼───────┐
│   DeepSeek    │    │    OpenAI     │    │   Claude      │
│  渠道1        │    │  渠道2        │    │  渠道3        │
│  API Key: xxx │    │  API Key: xxx │    │  API Key: xxx │
└───────────────┘    └───────────────┘    └───────────────┘
```

### 📌 扩展代码示例

```java
@Service
public class AIProxyService {

    @Autowired
    private OpenAiApi openAiApi;  // OpenAI 渠道

    @Autowired
    private DeepSeekApi deepSeekApi;  // DeepSeek 渠道

    public String chat(String message, String channel) {
        return switch (channel) {
            case "deepseek" -> deepSeekApi.chat(message);
            case "openai" -> openAiApi.chat(message);
            case "claude" -> claudeApi.chat(message);
            default -> throw new IllegalArgumentException("未知渠道: " + channel);
        };
    }
}
```

---

## 📂 项目结构

```
springAiDemo/
├── pom.xml                          # Maven 配置 (Spring AI 1.0.0-M4)
├── README.md                         # 项目文档
│
└── src/main/
    ├── java/com/example/deepseek/
    │   ├── DeepseekChatApplication.java    # Spring Boot 启动类
    │   └── controller/
    │       ├── ChatController.java         # 核心 AI 对话控制器
    │       └── PageController.java         # 页面路由控制器
    │
    └── resources/
        ├── application.properties           # 应用配置
        ├── static/
        │   ├── css/chat.css                # 样式表 (1143行)
        │   └── js/
        │       ├── app.js                  # 应用逻辑 (746行)
        │       └── markdown.js             # Markdown 渲染
        └── templates/
            └── chat.html                   # Thymeleaf 页面模板
```

---

## 🎨 界面预览

### 亮色主题
- Indigo + Violet 渐变配色
- 优雅的消息气泡设计
- 代码块语法高亮 + 一键复制

### 暗色主题
- 深色背景，护眼设计
- 一键切换主题
- 自动记忆用户偏好

### 功能特性
- ✅ Markdown 渲染
- ✅ 代码块高亮
- ✅ 流式打字机效果
- ✅ 多轮对话上下文
- ✅ 对话历史本地存储
- ✅ 对话导出 (JSON/Markdown)
- ✅ 系统提示词自定义
- ✅ Temperature 参数调节

---

## 📚 学习资源

- [Spring AI 官方文档](https://docs.spring.io/spring-ai/reference/)
- [Spring AI GitHub](https://github.com/spring-projects/spring-ai)
- [DeepSeek API 文档](https://platform.deepseek.com/docs)
- [OpenAI API 兼容协议](https://platform.openai.com/docs/api-reference/chat)

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 License

MIT License

---

## 👨‍💻 作者

**ZTSK** - Java 全栈工程师 | 中通快递技术团队

> *「不是 AI 淘汰了 Java 工程师，而是会用 AI 的 Java 工程师淘汰了不会用的。」*

---

<div align="center">

**如果这个项目对你有帮助，请 star ⭐ 支持一下！**

</div>
