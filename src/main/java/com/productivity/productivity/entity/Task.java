package com.productivity.productivity.entity;

import com.fasterxml.jackson.annotation.JsonBackReference;

import jakarta.persistence.*;
import java.time.LocalDate;

import jakarta.validation.constraints.*;



@Entity
@Table(name = "tasks")
public class Task {

    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    @NotBlank
    private String title;

    private String description;

    @Column(nullable = false)
    @Min(1)
    private int xpValue;

    private LocalDate dueDate;

    private String category;

    @Column(nullable = false)
    private boolean completed = false;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
        @JsonBackReference
    private User user;

    public Task() {
    }

    public Task(String title, String description, int xpValue, LocalDate dueDate, String category, boolean completed, User user) {
        this.title = title;
        this.description = description;
        this.xpValue = xpValue;
        this.dueDate = dueDate;
        this.category = category;
        this.completed = completed;
        this.user = user;
    }

    public Long getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public int getXpValue() {
        return xpValue;
    }

    public void setXpValue(int xpValue) {
        this.xpValue = xpValue;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public void setDueDate(LocalDate dueDate) {
        this.dueDate = dueDate;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public boolean isCompleted() {
        return completed;
    }

    public void setCompleted(boolean completed) {
        this.completed = completed;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }
}