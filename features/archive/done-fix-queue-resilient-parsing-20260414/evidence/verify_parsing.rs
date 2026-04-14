// Standalone verification test for fix-queue-resilient-parsing
// This file is NOT part of the crate -- it's run as a script via `rustc` to verify
// the core serde logic works correctly.

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
struct FeatureNode {
    id: String,
    #[serde(default)]
    name: String,
    #[serde(default)]
    priority: i32,
    #[serde(default)]
    size: String,
    #[serde(default, alias = "depends_on")]
    dependencies: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    parent: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    completed_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tag: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ParentEntry {
    id: String,
    #[serde(default)]
    name: String,
    #[serde(default, alias = "children")]
    features: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
struct QueueMeta {
    #[serde(default)]
    last_updated: String,
    #[serde(default)]
    version: i32,
}

fn main() {
    let mut passed = 0;
    let mut failed = 0;

    // Scenario 1: Normal queue.yaml
    {
        let yaml = r#"
id: feat-test
name: Test Feature
priority: 50
size: M
dependencies:
  - feat-dep1
"#;
        let node: FeatureNode = serde_yaml::from_str(yaml).unwrap();
        assert_eq!(node.id, "feat-test");
        assert_eq!(node.name, "Test Feature");
        assert_eq!(node.priority, 50);
        assert_eq!(node.dependencies, vec!["feat-dep1"]);
        println!("PASS: Scenario 1 - Normal queue.yaml rendering");
        passed += 1;
    }

    // Scenario 2: Extra fields (parent, description, status, etc.) silently ignored
    {
        let yaml = r#"
id: feat-extra
name: Extra Fields Feature
priority: 30
size: S
parent: parent-epic
description: "Some description"
status: active
defer_reason: "waiting"
value_points: 5
dependencies: []
"#;
        let node: FeatureNode = serde_yaml::from_str(yaml).unwrap();
        assert_eq!(node.id, "feat-extra");
        assert_eq!(node.parent, Some("parent-epic".to_string()));
        println!("PASS: Scenario 2 - Extra fields silently ignored");
        passed += 1;
    }

    // Scenario 3: depends_on field alias
    {
        let yaml = r#"
id: feat-alias
name: Alias Test
priority: 40
size: M
depends_on:
  - feat-dep-a
  - feat-dep-b
"#;
        let node: FeatureNode = serde_yaml::from_str(yaml).unwrap();
        assert_eq!(node.id, "feat-alias");
        assert_eq!(node.dependencies, vec!["feat-dep-a", "feat-dep-b"]);
        println!("PASS: Scenario 3 - depends_on field alias works");
        passed += 1;
    }

    // Scenario 4: ParentEntry children alias
    {
        let yaml = r#"
id: parent-epic
name: Epic
children:
  - feat-child-1
  - feat-child-2
"#;
        let entry: ParentEntry = serde_yaml::from_str(yaml).unwrap();
        assert_eq!(entry.id, "parent-epic");
        assert_eq!(entry.features, vec!["feat-child-1", "feat-child-2"]);
        println!("PASS: Scenario 4 - ParentEntry children alias works");
        passed += 1;
    }

    // Scenario 5: Malformed entry skipped (priority as string)
    {
        let top_yaml = r#"
meta:
  last_updated: "2026-04-14"
  version: 1
parents: []
active: []
pending:
  - id: feat-good
    name: Good Feature
    priority: 50
    size: M
  - id: feat-bad
    name: Bad Feature
    priority: "not-a-number"
    size: S
blocked: []
completed: []
"#;
        let top_level: serde_yaml::Value = serde_yaml::from_str(top_yaml).unwrap();
        let entries: Vec<FeatureNode> = top_level
            .get("pending")
            .and_then(|v| v.as_sequence())
            .map(|seq| {
                seq.iter().enumerate().filter_map(|(i, entry)| {
                    serde_yaml::from_value::<FeatureNode>(entry.clone()).ok()
                }).collect()
            })
            .unwrap_or_default();

        assert_eq!(entries.len(), 1, "Expected 1 good entry, bad one skipped");
        assert_eq!(entries[0].id, "feat-good");
        println!("PASS: Scenario 5 - Malformed entry skipped, rest render");
        passed += 1;
    }

    // Scenario 6: Only id field -- renders with defaults
    {
        let yaml = r#"id: feat-minimal"#;
        let node: FeatureNode = serde_yaml::from_str(yaml).unwrap();
        assert_eq!(node.id, "feat-minimal");
        assert_eq!(node.name, "");
        assert_eq!(node.priority, 0);
        assert_eq!(node.size, "");
        assert!(node.dependencies.is_empty());
        println!("PASS: Scenario 6 - Only-id entry renders with defaults");
        passed += 1;
    }

    // Scenario 7: Completely invalid YAML returns error
    {
        let yaml = "this is not: valid\n  broken: [yaml: content";
        let result: Result<serde_yaml::Value, _> = serde_yaml::from_str(yaml);
        assert!(result.is_err(), "Expected parse error for invalid YAML");
        println!("PASS: Scenario 7 - Invalid YAML returns error");
        passed += 1;
    }

    println!("\n=== Verification Summary ===");
    println!("Passed: {}/{}", passed, passed + failed);
    if failed > 0 {
        println!("Failed: {}", failed);
        std::process::exit(1);
    }
    println!("All scenarios verified!");
}
