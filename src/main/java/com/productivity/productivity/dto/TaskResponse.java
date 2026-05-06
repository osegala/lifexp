package com.productivity.productivity.dto;

import java.time.LocalDate;
import java.util.List;

public class TaskResponse {
    private Long id;
    private String title;
    private String description;
    private int xpValue;
    private LocalDate dueDate;
    private String category;
    private boolean completed;
    private List<String> unlockedCosmetics;

    public TaskResponse(Long id, String title, String description, int xpValue, LocalDate dueDate, String category, boolean completed) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.xpValue = xpValue;
        this.dueDate = dueDate;
        this.category = category;
        this.completed = completed;
    }

    public void setUnlockedCosmetics(List<String> unlockedCosmetics) {
        this.unlockedCosmetics = unlockedCosmetics;
    }

    public Long getId() { return id; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public int getXpValue() { return xpValue; }
    public LocalDate getDueDate() { return dueDate; }
    public String getCategory() { return category; }
    public boolean isCompleted() { return completed; }
    public List<String> getUnlockedCosmetics() { return unlockedCosmetics; }    
}