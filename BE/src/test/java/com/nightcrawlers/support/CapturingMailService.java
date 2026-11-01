package com.nightcrawlers.support;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import com.nightcrawlers.mail.MailService;
import com.nightcrawlers.mail.RenderedMail;

/**
 * Keeps sent emails in memory instead of talking to SMTP. Reads wait until the mail executor
 * (if any) has finished its queued sends, so asynchronous delivery stays deterministic in tests.
 */
public class CapturingMailService implements MailService {

    private static final Pattern TOKEN = Pattern.compile("token=([A-Za-z0-9_-]+)");

    public record Mail(String to, String subject, String html, String text) {

        public Optional<String> token() {
            Matcher m = TOKEN.matcher(html);
            return m.find() ? Optional.of(m.group(1)) : Optional.empty();
        }
    }

    private final List<Mail> sent = new CopyOnWriteArrayList<>();
    private final Supplier<ThreadPoolTaskExecutor> executor;
    private volatile CountDownLatch gate;

    public CapturingMailService(Supplier<ThreadPoolTaskExecutor> executor) {
        this.executor = executor;
    }

    @Override
    public void send(String to, String subject, RenderedMail body) {
        CountDownLatch current = gate;
        if (current != null) {
            try {
                current.await(30, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
        sent.add(new Mail(to, subject, body.html(), body.text()));
    }

    /** Makes every send block (like a slow SMTP relay) until {@link #unblock} is called. */
    public CountDownLatch blockSends() {
        CountDownLatch latch = new CountDownLatch(1);
        gate = latch;
        return latch;
    }

    public void unblock(CountDownLatch latch) {
        gate = null;
        latch.countDown();
    }

    public List<Mail> to(String address) {
        awaitIdle();
        return sent.stream().filter(m -> m.to().equals(address)).toList();
    }

    public Mail lastTo(String address) {
        List<Mail> mails = to(address);
        if (mails.isEmpty()) {
            throw new AssertionError("No email sent to " + address);
        }
        return mails.getLast();
    }

    private void awaitIdle() {
        ThreadPoolTaskExecutor pool = executor.get();
        if (pool == null) {
            return;
        }
        var tpe = pool.getThreadPoolExecutor();
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
        while (tpe.getCompletedTaskCount() < tpe.getTaskCount() && System.nanoTime() < deadline) {
            try {
                Thread.sleep(5);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
    }
}
