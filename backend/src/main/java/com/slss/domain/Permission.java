package com.slss.domain;
import jakarta.persistence.*;
@Entity @Table(name="permissions") public class Permission { @Id @GeneratedValue(strategy=GenerationType.IDENTITY) Long id; @Column(nullable=false,unique=true) String code; protected Permission(){} public Permission(String code){this.code=code;} public String getCode(){return code;} }
