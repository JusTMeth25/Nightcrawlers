package com.nightcrawlers.ripperdoc;

import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.nightcrawlers.common.ApiException;
import com.nightcrawlers.common.audit.AuditEvent;
import com.nightcrawlers.common.audit.AuditService;
import com.nightcrawlers.gamedata.GameData;
import com.nightcrawlers.gamedata.model.RipperdocDef;
import com.nightcrawlers.save.PlayerSave;
import com.nightcrawlers.save.PlayerSaveRepository;
import com.nightcrawlers.save.RipperdocUpgrade;
import com.nightcrawlers.save.RipperdocUpgradeRepository;
import com.nightcrawlers.save.SaveDto;
import com.nightcrawlers.save.SaveService;
import com.nightcrawlers.user.User;
import com.nightcrawlers.user.UserRepository;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Ripperdoc purchases. Each attempt is one transaction guarded by the optimistic lock on
 * {@code PlayerSave.version}: a concurrent change of the save (another purchase, a run reward)
 * makes the attempt fail, and it is retried once on fresh data before answering 409.
 */
@Service
public class RipperdocService {

    private static final Logger log = LoggerFactory.getLogger(RipperdocService.class);

    private final GameData gameData;
    private final UserRepository users;
    private final PlayerSaveRepository saves;
    private final RipperdocUpgradeRepository upgrades;
    private final SaveService saveService;
    private final AuditService audit;
    private final TransactionTemplate transaction;

    public RipperdocService(GameData gameData, UserRepository users, PlayerSaveRepository saves,
            RipperdocUpgradeRepository upgrades, SaveService saveService, AuditService audit,
            PlatformTransactionManager transactionManager) {
        this.gameData = gameData;
        this.users = users;
        this.saves = saves;
        this.upgrades = upgrades;
        this.saveService = saveService;
        this.audit = audit;
        this.transaction = new TransactionTemplate(transactionManager);
    }

    public SaveDto buy(UUID userId, String upgradeId, HttpServletRequest http) {
        RipperdocDef def = gameData.ripperdoc(upgradeId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                "Potenziamento non trovato", "Il potenziamento richiesto non esiste."));
        try {
            return transaction.execute(status -> purchase(userId, def, http));
        } catch (OptimisticLockingFailureException | DataIntegrityViolationException firstConflict) {
            log.info("Ripperdoc purchase conflict, retrying once");
            try {
                return transaction.execute(status -> purchase(userId, def, http));
            } catch (OptimisticLockingFailureException | DataIntegrityViolationException secondConflict) {
                throw new ApiException(HttpStatus.CONFLICT, "Acquisto non riuscito",
                        "Il salvataggio è stato modificato da un'altra richiesta. Riprova.");
            }
        }
    }

    private SaveDto purchase(UUID userId, RipperdocDef def, HttpServletRequest http) {
        User user = users.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Non autenticato"));
        if (!user.isEmailVerified()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Email non verificata",
                    "Conferma il tuo indirizzo email per usare il Ripperdoc.");
        }
        PlayerSave save = saves.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Salvataggio non trovato"));
        RipperdocUpgrade upgrade = upgrades.findById(new RipperdocUpgrade.Key(userId, def.id())).orElse(null);
        int rank = upgrade == null ? 0 : upgrade.getRank();
        if (rank >= def.maxRank()) {
            throw new ApiException(HttpStatus.CONFLICT, "Grado massimo raggiunto",
                    "Questo potenziamento è già al grado massimo.");
        }
        long cost = gameData.ripperdocCost(def, rank);
        if (save.getEurodollars() < cost) {
            throw new ApiException(HttpStatus.CONFLICT, "Eurodollari insufficienti",
                    "Servono " + cost + " €$ per il prossimo grado.");
        }
        save.setEurodollars(save.getEurodollars() - cost);
        // Version check first, so a concurrent purchase fails here, before touching the rank row.
        saves.saveAndFlush(save);
        if (upgrade == null) {
            upgrades.saveAndFlush(new RipperdocUpgrade(userId, def.id(), 1));
        } else {
            upgrade.setRank(rank + 1);
            upgrades.saveAndFlush(upgrade);
        }
        audit.record(AuditEvent.RIPPERDOC_PURCHASE, userId, http);
        return saveService.load(userId);
    }
}
