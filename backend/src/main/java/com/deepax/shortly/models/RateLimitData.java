package com.deepax.shortly.models;

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RateLimitData {
    private int minuteCount;
    private int hourCount;

    // 10:02 //10:01:30
    private LocalDateTime minuteWindowStart;
    private LocalDateTime hourWindowStart;
}
