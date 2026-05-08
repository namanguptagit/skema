use sqlparser::dialect::GenericDialect;
use sqlparser::parser::Parser;
fn main() {
    let sql = "CREATE TABLE users (id INT PRIMARY KEY, profile_id INT, FOREIGN KEY (profile_id) REFERENCES profiles(id));";
    let dialect = GenericDialect {};
    let ast = Parser::parse_sql(&dialect, sql).unwrap();
    println!("{:#?}", ast);
}
