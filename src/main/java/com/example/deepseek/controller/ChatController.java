package com.example.deepseek.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.SimpleLoggerAdvisor;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chat")
@CrossOrigin(origins = "*")
public class ChatController {

    private static final Logger log = LoggerFactory.getLogger(ChatController.class);

    private final ChatClient chatClient;
    // 使用 ArrayList + synchronized 替代 CopyOnWriteArrayList，以支持 remove(last) 操作
    private final List<ChatMessage> messageHistory = new ArrayList<>();

    public ChatController(ChatModel chatModel) {
        log.info("[ChatController] 初始化，构建 ChatClient...");
        this.chatClient = ChatClient.builder(chatModel)
                .defaultAdvisors(new SimpleLoggerAdvisor())
                .build();
        log.info("[ChatController] ChatClient 构建完成");
    }

    /**
     * SSE 流式输出 - 前端逐字打字机效果
     */
    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<String> chatStream(@RequestBody Map<String, String> request) {
        String userMessage = request.get("message");
        log.info("[chatStream] ═══════════════════════════════════════════");
        log.info("[chatStream] 【收到流式请求】消息内容: {}", userMessage);
        log.info("[chatStream] 消息长度: {}", userMessage == null ? 0 : userMessage.length());

        if (userMessage == null || userMessage.isBlank()) {
            log.warn("[chatStream] 消息为空，直接返回 DONE");
            return Flux.just("data: [DONE]\n\n");
        }

        // 保存用户消息
        synchronized (messageHistory) {
            messageHistory.add(new ChatMessage("user", userMessage));
        }
        log.info("[chatStream] 已保存用户消息，当前历史条数={}", messageHistory.size());

        // 构建带历史的提示词
        String contextPrompt = buildContextPrompt(userMessage);
        log.info("[chatStream] 构建的完整提示词:\n{}", contextPrompt);
        log.debug("[chatStream] contextPrompt 长度={}", contextPrompt.length());

        // 用于收集完整 AI 回复
        StringBuilder fullResponse = new StringBuilder();

        return chatClient.prompt()
                .user(contextPrompt)
                .stream()
                .content()
                .doOnSubscribe(s -> log.info("[chatStream] ▶▶▶ 开始订阅 DeepSeek 流式响应"))
                .doOnNext(chunk -> {
                    fullResponse.append(chunk);
                    log.info("[chatStream] 【AI chunk】长度={}", chunk.length());
                })
                .doOnComplete(() -> {
                    // 流完成后保存完整回复
                    String finalResponse = fullResponse.toString();
                    log.info("[chatStream] 【AI 完整回复】总长度={}", finalResponse.length());
                    if (!finalResponse.isBlank()) {
                        synchronized (messageHistory) {
                            messageHistory.add(new ChatMessage("assistant", finalResponse));
                        }
                    }
                })
                .doOnError(e -> log.error("[chatStream] 流式响应异常: {}", e.getMessage(), e))
                // 直接返回原始文本，不包装 SSE 格式
                .map(chunk -> "TEXT:" + chunk)
                .concatWith(Flux.just("DONE"))
                .onErrorReturn("ERROR:" + "生成失败");
    }

    /**
     * 普通同步接口 (备用)
     */
    @PostMapping("/send")
    public Map<String, Object> chat(@RequestBody Map<String, String> request) {
        String userMessage = request.get("message");
        log.info("[chat/send] 收到同步请求，消息长度={}", userMessage == null ? 0 : userMessage.length());

        if (userMessage == null || userMessage.isBlank()) {
            log.warn("[chat/send] 消息为空，拒绝请求");
            return Map.of("success", false, "error", "消息不能为空");
        }

        synchronized (messageHistory) {
            messageHistory.add(new ChatMessage("user", userMessage));
        }
        log.info("[chat/send] 已保存用户消息，当前历史条数={}", messageHistory.size());

        String contextPrompt = buildContextPrompt(userMessage);
        log.debug("[chat/send] contextPrompt 长度={}", contextPrompt.length());

        try {
            log.info("[chat/send] 调用 DeepSeek 同步接口...");
            String response = chatClient.prompt()
                    .user(contextPrompt)
                    .call()
                    .content();

            log.info("[chat/send] 收到 AI 响应，长度={}", response == null ? 0 : response.length());
            synchronized (messageHistory) {
                messageHistory.add(new ChatMessage("assistant", response));
            }
            log.info("[chat/send] 已保存 AI 回复，当前历史条数={}", messageHistory.size());
            return Map.of("response", response, "success", true);

        } catch (Exception e) {
            log.error("[chat/send] 调用 DeepSeek 异常: {}", e.getMessage(), e);
            // 移除刚才加入的用户消息（回滚）
            synchronized (messageHistory) {
                if (!messageHistory.isEmpty()) {
                    messageHistory.remove(messageHistory.size() - 1);
                    log.info("[chat/send] 已回滚用户消息，当前历史条数={}", messageHistory.size());
                }
            }
            return Map.of("success", false, "error", e.getMessage());
        }
    }

    /**
     * 清空对话历史
     */
    @DeleteMapping("/clear")
    public Map<String, Object> clearHistory() {
        int prevSize;
        synchronized (messageHistory) {
            prevSize = messageHistory.size();
            messageHistory.clear();
        }
        log.info("[clearHistory] 对话历史已清除，清除前条数={}", prevSize);
        return Map.of("success", true, "message", "对话历史已清除");
    }

    /**
     * 获取对话历史
     */
    @GetMapping("/history")
    public Map<String, Object> getHistory() {
        List<Map<String, String>> historyList;
        synchronized (messageHistory) {
            historyList = messageHistory.stream()
                    .map(m -> Map.of("role", m.role(), "content", m.content()))
                    .toList();
        }
        log.info("[getHistory] 查询对话历史，共 {} 条", historyList.size());
        return Map.of("history", historyList, "count", historyList.size());
    }

    /**
     * 构建包含上下文的提示词
     */
    private String buildContextPrompt(String currentMessage) {
        int historySize;
        synchronized (messageHistory) {
            historySize = messageHistory.size();
        }
        log.debug("[buildContextPrompt] 当前历史条数={}，currentMessage长度={}", historySize, currentMessage.length());

        if (historySize <= 1) {
            return currentMessage;
        }

        StringBuilder sb = new StringBuilder();
        sb.append("以下是对话历史，请基于上下文回答：\n\n");

        synchronized (messageHistory) {
            // 取最近 10 轮对话（不含当前消息）
            int start = Math.max(0, messageHistory.size() - 11);
            for (int i = start; i < messageHistory.size() - 1; i++) {
                ChatMessage msg = messageHistory.get(i);
                String role = "user".equals(msg.role()) ? "用户" : "助手";
                sb.append(role).append(": ").append(msg.content()).append("\n\n");
            }
        }
        sb.append("用户: ").append(currentMessage);

        log.debug("[buildContextPrompt] 构建完成，长度={}", sb.length());
        return sb.toString();
    }

    public record ChatMessage(String role, String content) {}
}
