use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IniEntry {
    pub value: String,
    pub raw_value: String,
    pub enabled: bool,
    pub line_idx: usize,
    pub value_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwitchIni {
    pub path: PathBuf,
    pub raw_lines: Vec<String>,
    pub sections: HashMap<String, HashMap<String, IniEntry>>,
    pub sections_order: Vec<String>,
}

impl SwitchIni {
    pub fn parse<P: AsRef<Path>>(path: P) -> Result<Self> {
        let p = path.as_ref().to_path_buf();
        let content = fs::read_to_string(&p)?;
        let mut raw_lines: Vec<String> = content.lines().map(|s| s.to_string()).collect();
        // Ensure at least one line if empty
        if raw_lines.is_empty() {
            raw_lines.push(String::new());
        }

        let mut sections = HashMap::new();
        let mut sections_order = Vec::new();
        let mut current_section: Option<String> = None;

        for (idx, line) in raw_lines.iter().enumerate() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') {
                continue;
            }

            if trimmed.starts_with('[') && trimmed.ends_with(']') {
                let name = trimmed[1..trimmed.len() - 1].to_string();
                current_section = Some(name.clone());
                if !sections.contains_key(&name) {
                    sections.insert(name.clone(), HashMap::new());
                    sections_order.push(name);
                }
                continue;
            }

            if let Some(section_name) = &current_section {
                let mut enabled = true;
                let mut parse_line = trimmed;

                if trimmed.starts_with(';') {
                    enabled = false;
                    parse_line = trimmed[1..].trim();
                }

                if let Some(eq_idx) = parse_line.find('=') {
                    let key = parse_line[..eq_idx].trim().to_string();
                    let raw_val = parse_line[eq_idx + 1..].trim().to_string();

                    let (val, vtype) = Self::parse_switch_value(&raw_val);

                    sections.get_mut(section_name).unwrap().insert(
                        key,
                        IniEntry {
                            value: val,
                            raw_value: raw_val,
                            enabled,
                            line_idx: idx,
                            value_type: vtype,
                        },
                    );
                }
            }
        }

        Ok(Self {
            path: p,
            raw_lines,
            sections,
            sections_order,
        })
    }

    fn parse_switch_value(raw: &str) -> (String, Option<String>) {
        if let Some(bang_idx) = raw.find('!') {
            let vtype = &raw[..bang_idx];
            if matches!(vtype, "u8" | "u64" | "str") {
                return (raw[bang_idx + 1..].to_string(), Some(vtype.to_string()));
            }
        }
        (raw.to_string(), None)
    }

    pub fn get_value(&self, section: &str, key: &str) -> Option<&IniEntry> {
        self.sections.get(section).and_then(|s| s.get(key))
    }

    pub fn set_value(
        &mut self,
        section: &str,
        key: &str,
        value: &str,
        vtype: Option<&str>,
        enabled: bool,
    ) -> bool {
        if !self.sections.contains_key(section) {
            self.sections.insert(section.to_string(), HashMap::new());
            self.sections_order.push(section.to_string());
        }

        let formatted_raw = match vtype {
            Some("u8") | Some("u64") => {
                // Parse the value as a number if possible to ensure clean hex formatting
                if let Ok(num) = value.parse::<u64>() {
                    format!("{}!0x{:x}", vtype.unwrap(), num)
                } else if value.starts_with("0x") {
                    format!("{}!{}", vtype.unwrap(), value)
                } else {
                    format!("{}!{}", vtype.unwrap(), value)
                }
            }
            Some(t) => format!("{}!{}", t, value),
            None => value.to_string(),
        };

        if let Some(entry) = self.sections.get_mut(section).unwrap().get_mut(key) {
            if entry.value == value
                && entry.enabled == enabled
                && entry.value_type.as_deref() == vtype
            {
                return false;
            }
            entry.value = value.to_string();
            entry.raw_value = formatted_raw.clone();
            entry.enabled = enabled;
            entry.value_type = vtype.map(|s| s.to_string());

            let prefix = if enabled { "" } else { "; " };
            self.raw_lines[entry.line_idx] = format!("{}{} = {}", prefix, key, formatted_raw);
            return true;
        }

        // New Key
        let line_idx = self.find_section_end(section);
        let prefix = if enabled { "" } else { "; " };
        let new_line = format!("{}{} = {}", prefix, key, formatted_raw);

        self.raw_lines.insert(line_idx, new_line);
        // Update indices
        for s in self.sections.values_mut() {
            for e in s.values_mut() {
                if e.line_idx >= line_idx {
                    e.line_idx += 1;
                }
            }
        }

        self.sections.get_mut(section).unwrap().insert(
            key.to_string(),
            IniEntry {
                value: value.to_string(),
                raw_value: formatted_raw,
                enabled,
                line_idx,
                value_type: vtype.map(|s| s.to_string()),
            },
        );
        true
    }

    fn find_section_end(&self, section: &str) -> usize {
        let mut start = None;
        for (idx, line) in self.raw_lines.iter().enumerate() {
            let t = line.trim();
            if t == format!("[{}]", section) {
                start = Some(idx);
            } else if start.is_some() && t.starts_with('[') {
                return idx;
            }
        }
        self.raw_lines.len()
    }

    pub fn write(&self) -> Result<()> {
        let content = self.raw_lines.join("\n");
        fs::write(&self.path, content)?;
        Ok(())
    }
}
