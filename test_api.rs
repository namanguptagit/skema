use sqlparser::ast::{ColumnOption, TableConstraint};
fn main() {
    let _a = ColumnOption::Unique { };
    let _b = ColumnOption::ForeignKey { };
    let _c = TableConstraint::ForeignKey { };
}
