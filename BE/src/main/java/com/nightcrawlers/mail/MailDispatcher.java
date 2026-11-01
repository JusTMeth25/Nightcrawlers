package com.nightcrawlers.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskExecutor;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class MailDispatcher {

    private static final Logger log = LoggerFactory.getLogger(MailDispatcher.class);

    private final MailService mail;
    private final TaskExecutor executor;

    public MailDispatcher(MailService mail, @Qualifier(MailConfig.EXECUTOR) TaskExecutor executor) {
        this.mail = mail;
        this.executor = executor;
    }

    /** After commit; outside a transaction (fallbackExecution) it is dispatched immediately. */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void dispatch(MailMessage message) {
        try {
            executor.execute(() -> mail.send(message.to(), message.subject(), message.body()));
        } catch (TaskRejectedException e) {
            log.warn("Mail queue full, email dropped");
        }
    }
}
