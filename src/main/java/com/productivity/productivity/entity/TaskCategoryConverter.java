package com.productivity.productivity.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class TaskCategoryConverter implements AttributeConverter<TaskCategory, String> {

    @Override
    public String convertToDatabaseColumn(TaskCategory category) {
        return category == null ? null : category.getLabel();
    }

    @Override
    public TaskCategory convertToEntityAttribute(String value) {
        return TaskCategory.fromValue(value);
    }
}
