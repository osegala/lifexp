package com.productivity.productivity.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;

public class CreateTaskRequest {
    @NotBlank
    private String title;

    private String description;

    @Min(1)
    private int xpValue;

    private LocalDate dueDate;

    private String category;

    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public int getXpValue() { return xpValue; }
    public LocalDate getDueDate() { return dueDate; }
    public String getCategory() { return category; }

    public void setTitle(String title) { this.title = title; }
    public void setDescription(String description) { this.description = description; }
    public void setXpValue(int xpValue) { this.xpValue = xpValue; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }
    public void setCategory(String category) { this.category = category; }
}