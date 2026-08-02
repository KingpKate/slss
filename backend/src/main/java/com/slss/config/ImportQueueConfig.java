package com.slss.config;

import org.springframework.amqp.core.*;
import org.springframework.beans.factory.annotation.Value; import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.*;

@Configuration
@ConditionalOnProperty(name="slss.import.executor", havingValue="rabbit")
public class ImportQueueConfig {
 @Bean DirectExchange productionImportExchange(@Value("${slss.import.exchange:slss.import.exchange}") String name){return new DirectExchange(name,true,false);}
 @Bean Queue productionImportQueue(@Value("${slss.import.queue}") String name,@Value("${slss.import.dlx:slss.import.dlx}") String dlx){return QueueBuilder.durable(name).deadLetterExchange(dlx).deadLetterRoutingKey("failed").build();}
 @Bean DirectExchange productionImportDlx(@Value("${slss.import.dlx:slss.import.dlx}") String name){return new DirectExchange(name,true,false);}
 @Bean Queue productionImportDeadQueue(@Value("${slss.import.dead-queue:slss.import.dead}") String name){return QueueBuilder.durable(name).build();}
 @Bean Queue productionImportRetryQueue(@Value("${slss.import.retry-queue:slss.import.retry}") String name,@Value("${slss.import.exchange:slss.import.exchange}") String exchange){return QueueBuilder.durable(name).deadLetterExchange(exchange).deadLetterRoutingKey("execute").build();}
 @Bean Binding productionImportBinding(@Qualifier("productionImportQueue") Queue productionImportQueue,@Qualifier("productionImportExchange") DirectExchange productionImportExchange){return BindingBuilder.bind(productionImportQueue).to(productionImportExchange).with("execute");}
 @Bean Binding productionImportDeadBinding(@Qualifier("productionImportDeadQueue") Queue queue,@Qualifier("productionImportDlx") DirectExchange dlx){return BindingBuilder.bind(queue).to(dlx).with("failed");}
 @Bean Binding productionImportRetryBinding(@Qualifier("productionImportRetryQueue") Queue queue,@Qualifier("productionImportExchange") DirectExchange exchange){return BindingBuilder.bind(queue).to(exchange).with("retry");}
}
