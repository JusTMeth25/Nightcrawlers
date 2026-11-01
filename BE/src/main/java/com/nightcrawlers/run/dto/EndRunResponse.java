package com.nightcrawlers.run.dto;

import java.util.List;

import com.nightcrawlers.save.SaveDto;

public record EndRunResponse(long eurodollarsAwarded, List<String> newUnlocks, boolean flagged, SaveDto save) {
}
